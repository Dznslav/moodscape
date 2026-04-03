import asyncio
import httpx
import time
import random
import string
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"


def random_string(length=8):
    return ''.join(random.choices(string.ascii_lowercase, k=length))


async def main():
    try:
        async with httpx.AsyncClient(base_url=BASE_URL) as client:
            email = f"test_{random_string()}@test.com"
            password = "password123"
            print(f"[*] Registering: {email}")

            t0 = time.time()
            res = await client.post("/auth/register", json={
                "name": "Perf Tester",
                "email": email,
                "password": password
            })
            if res.status_code != 201:
                print(f"Registration failed. Is the server running? {res.text}")
                return

            print(f"    Registration: {time.time() - t0:.3f}s")

            res = await client.post("/auth/login", data={"username": email, "password": password})
            token = res.json()["access_token"]
            headers = {"Authorization": f"Bearer {token}"}

            print("\n[*] Adding 14 records (warm-start threshold)...")
            for i in range(14):
                date_str = (datetime.utcnow() - timedelta(days=14 - i)).isoformat()
                await client.post("/records", headers=headers, json={
                    "mood": random.randint(1, 5),
                    "energy": random.randint(1, 5),
                    "note": f"Test {i}",
                    "timestamp": date_str
                })
            print("    Done.")

            print("\n[*] First prediction (synchronous training)...")
            t0 = time.time()
            res = await client.post("/predictions/tomorrow", headers=headers, json={
                "target_date": (datetime.utcnow() + timedelta(days=1)).isoformat(),
                "latitude": 53.9,
                "longitude": 27.5
            })
            first_duration = time.time() - t0
            print(f"    {first_duration:.3f}s")

            print("\n[*] Adding 16 more records (reaching 30 for retrain)...")
            for i in range(16):
                await client.post("/records/", headers=headers, json={
                    "mood": random.randint(1, 5),
                    "energy": random.randint(1, 5),
                    "note": f"New Test {i}"
                })

            print("\n[*] Second prediction (background retrain)...")
            t0 = time.time()
            res = await client.post("/predictions/tomorrow", headers=headers, json={
                "target_date": (datetime.utcnow() + timedelta(days=2)).isoformat(),
                "latitude": 53.9,
                "longitude": 27.5
            })
            second_duration = time.time() - t0
            print(f"    {second_duration:.3f}s")

            if second_duration > 0:
                print(f"\n    Speedup: {first_duration / second_duration:.1f}x")

    except httpx.ConnectError:
        print("\nError: Cannot connect to http://localhost:8000")

if __name__ == "__main__":
    asyncio.run(main())
