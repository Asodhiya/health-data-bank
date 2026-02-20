from fastapi import FastAPI,HTTPException,status,Cookie
from typing import Annotated
import jwt
from jose import JWTError

# middleware function to check if there is a valid cookie or not
async def auth_middleware(token: Annotated[str,Cookie()] = None ):
    credential_execption = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail = "Could not validate credential"
    )
    if not token:
        raise credential_execption
    #check if the token is valid or not
    try:
        payload =  jwt.decode(token,SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    
    except JWTError:
        raise credential_execption

