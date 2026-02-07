from fastapi import HTTPException, status
from app.core.database import get_db
from app.core.security import PasswordHash
from app.middleware.signup_validation import UserSignup

async def authenticate_user(email: str, password: str):
    """
    For the table columns are just a test that will be changed in the future.
    (for connecting db, check .env file) --needs config.py (should be edited in next sprints)
    """
    query = "SELECT * FROM app_users WHERE email = %s"
    
    try:
        async with get_db() as conn:
            async with conn.cursor() as cur:
                await cur.execute(query, (email,))
                user = await cur.fetchone() # Returns a dict because of row_factory=dict_row
                
    except Exception as e:
        # Handle DB connection errors
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))

    # Check if user exists
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    stored_hash = user.get("password_hash")
    # verify hashed pass if it matches with the stored hashed db
    if not stored_hash or not PasswordHash.from_str(stored_hash).verify(password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )

    return user

async def create_user(user_data: UserSignup):
    """
    Creates a new user in 'app_users' table using raw SQL.
    """
    # Hash the password
    hashed_pw = PasswordHash.from_password(user_data.password).to_str()
    
    query = """
        INSERT INTO app_users (email, password_hash)
        VALUES (%s, %s)
        RETURNING *;
    """
    
    try:
        async with get_db() as conn:
            async with conn.cursor() as cur:
                await cur.execute(query, (user_data.email, hashed_pw))
                new_user = await cur.fetchone()
                # Commit is usually handled by the context manager or autocommit, 
                # but with psycopg3 async pool we might need explicit commit if not in autocommit mode.
                # The pool in database.py usually yields a connection. 
                # If it's not autocommit, we need: await conn.commit()
                await conn.commit()
                return new_user
                
    except Exception as e:
        # Likely a duplicate email error (UniqueViolation)
        # In a real app, check e.sqlstate or similar
        raise HTTPException(status_code=400, detail=f"User already exists or error: {str(e)}")
