from fastapi import Depends, HTTPException, Request , Response
async def get_current_user(request: Request):
    token = request.cookies.get("token")
    if not token:
        raise HTTPException(401, detail="Not authenticated")
    
    payload = decode_access_token(token)
    user_id = payload.get("sub")

    if not user_id:
        raise HTTPException(401, detail="Invalid token")
    user  = await(get_user_by_id(user_id))
    if not user:
        raise HTTPException(401 , detail="User not found")
    
    return user


        