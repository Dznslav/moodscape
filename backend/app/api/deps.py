from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.db.database import get_db
from app.models.models import User
from app.core.security import SECRET_KEY, ALGORITHM

                                                                        
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")

async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)):
    """
    Зависимость для проверки JWT токена и получения текущего пользователя.
    """
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Не удалось проверить учетные данные",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
                                                                          
    from app.core.redis import safe_get
    is_blacklisted = await safe_get(f"blacklist:{token}")
    if is_blacklisted:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has been revoked",
            headers={"WWW-Authenticate": "Bearer"},
        )

    try:
                          
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub: str = payload.get("sub")
        if sub is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
                                                                            
    if "@" in str(sub) or not str(sub).isdigit():
        result = await db.execute(select(User).filter(User.email == str(sub)))
    else:
        result = await db.execute(select(User).filter(User.id == int(sub)))
    user = result.scalar_one_or_none()
    
                                                                           
    if user is None or user.deleted_at is not None:
        raise credentials_exception
        
    return user
