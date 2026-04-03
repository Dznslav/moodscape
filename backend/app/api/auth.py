import time

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.concurrency import run_in_threadpool
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import jwt as jose_jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.api.deps import get_current_user
from app.core.redis import delete_by_pattern, safe_delete, safe_set
from app.core.security import ALGORITHM, SECRET_KEY, create_access_token, get_password_hash, verify_password
from app.db.database import get_db
from app.models.models import User
from app.schemas.schemas import Token, UserCreate, UserResponse
from app.services.log_service import queue_log

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(user_data: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).filter(User.email == user_data.email))
    db_user = result.scalar_one_or_none()
    if db_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists",
        )

    hashed_password = await run_in_threadpool(get_password_hash, user_data.password)
    new_user = User(
        name=user_data.name,
        email=user_data.email,
        password_hash=hashed_password,
    )

    db.add(new_user)
    await db.flush()
    await db.refresh(new_user)

    queue_log(db, new_user.id, "REGISTER", f"User {new_user.email} registered")
    await db.commit()

    return new_user


@router.post("/login", response_model=Token)
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).filter(User.email == form_data.username))
    user = result.scalar_one_or_none()

    is_valid_password = (
        await run_in_threadpool(verify_password, form_data.password, user.password_hash)
        if user
        else False
    )
    if not user or not is_valid_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(data={"sub": str(user.id)})
    
    queue_log(db, user.id, "LOGIN", f"User {user.email} logged in successfully")
    await db.commit()

    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/logout", status_code=status.HTTP_200_OK)
async def logout(
    token: str = Depends(oauth2_scheme),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        await safe_delete(f"records:{current_user.id}")
        await safe_delete(f"sleep_logs:{current_user.id}")
        await delete_by_pattern(f"records:today:{current_user.id}:*")
        await delete_by_pattern(f"cold_prediction*:{current_user.id}:*")
        await delete_by_pattern(f"warm_prediction*:{current_user.id}:*")

        payload = jose_jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        exp = payload.get("exp")
        if not exp:
            raise HTTPException(status_code=400, detail="Token has no expiration time")

        ttl = exp - int(time.time())
        if ttl > 0:
            await safe_set(f"blacklist:{token}", "true", ex=ttl)

    except jose_jwt.JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    queue_log(db, current_user.id, "LOGOUT", f"User {current_user.email} logged out")
    await db.commit()
    return {"msg": "Logged out successfully"}
