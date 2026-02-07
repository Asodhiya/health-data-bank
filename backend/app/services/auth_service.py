from fastapi import HTTPException, status
from app.core.supabase_client import supabase
from app.core.security import PasswordHash
from app.middleware.signup_validation import UserSignup

async def authenticate_user(email: str, password: str):
    """
    For the table columns are just a test that will be changed in the future.
    - app_users - table (from mock db) --Again, change in next sprints
    (for connecting db, check .env file) --needs config.py (should be edited in next sprints)
    """

    #check if email is in db
    try:
        response = supabase.table("app_users").select("*").eq("email", email).execute()
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    # checks if user exists
    if not response.data:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    user = response.data[0]
    stored_hash = user.get("password_hash")
    # verify hashed pass if it matches with the stored hashed db
    if not stored_hash or not PasswordHash.from_str(stored_hash).verify(password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    return user

async def create_user(user_data: UserSignup):
    hashed_pw = PasswordHash.from_password(user_data.password).to_str()
    insert_data = {
        "email": user_data.email,
        "password_hash": hashed_pw,
        # "first_name": user_data.first_name,
        # "phone": user_data.phone
    }

    try:
        response = supabase.table("app_users").insert(insert_data).execute()
        return response.data[0]
    except Exception as e:
        # Likely a duplicate email error
        raise HTTPException(status_code=400, detail="User already exists or error creating user")
