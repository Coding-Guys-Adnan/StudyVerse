import asyncio
import json
import urllib.request
import urllib.error
from app.core.security import create_access_token

async def main():
    user_id = "114fd4cf-01aa-44f1-ac08-ada0cecb2eef"
    token = create_access_token(data={"sub": user_id, "role": "student"})
    
    url = "http://localhost:8005/api/v1/portal/profile"
    req = urllib.request.Request(
        url, 
        headers={"Authorization": f"Bearer {token}"},
        method="GET"
    )
    try:
        with urllib.request.urlopen(req) as response:
            print("Live server status code:", response.status)
            print("Live server response JSON:", json.loads(response.read().decode()))
    except urllib.error.HTTPError as e:
        print("Live server status error:", e.code)
        print("Live server response error:", e.read().decode())
    except Exception as e:
        print("Connection error:", e)

asyncio.run(main())
