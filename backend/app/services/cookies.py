from fastapi import Response
import os
from dotenv import load_dotenv
load_dotenv()
def _set_cookie(response: Response, token: str):
    response.set_cookie(
        key="token",
        value=token,
        httponly=True,
        secure=False, # Set to True in production (HTTPS)
        samesite="lax",
        max_age=int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES")) * 60
    )