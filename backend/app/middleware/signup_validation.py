import re
from pydantic import BaseModel, EmailStr, field_validator, ValidationInfo

class UserSignup(BaseModel):
    first_name: str
    last_name: str
    username: str
    email: EmailStr
    password: str
    confirm_password: str
    phone: str

    @field_validator("first_name", "last_name", "username", "phone")
    @classmethod
    def strip_text(cls,v: str):
        if isinstance(v, str):
            return v.strip()
        return v

    @field_validator('first_name', 'last_name', 'username', 'password', 'confirm_password', 'phone')
    @classmethod
    def validate_not_empty(cls, v: str):
        if not v or not v.strip():
            raise ValueError(v + 'Field cannot be left empty or whitespace')
        return v

    @field_validator('username')
    @classmethod
    def validate_username_format(cls, v: str):
        #alphanumeric and underscores only
        if not re.match(r'^[a-zA-Z0-9_]+$', v):
            raise ValueError('Username must contain only alphanumeric characters and underscores')
        return v

    @field_validator('email')
    @classmethod
    def validate_email_custom(cls, v: str):
        #test@test.test (MUST LOOK LIKE)
        email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not re.match(email_regex, str(v)):
            raise ValueError('Invalid email format')
        return v

    @field_validator('password')
    @classmethod
    def validate_password_strength(cls, v: str):
        min_length = 8
        errors = []
        if len(v) < min_length:
            errors.append(f"Password must be at least {min_length} characters long.")
        if not re.search(r"[A-Z]", v):
            errors.append("Password must contain at least one uppercase letter.")
        if not re.search(r"[a-z]", v):
            errors.append("Password must contain at least one lowercase letter.")
        if not re.search(r"[0-9]", v):
            errors.append("Password must contain at least one digit.")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v):
            errors.append("Password must contain at least one special character.")
        
        if errors:
            raise ValueError(" ".join(errors))
        return v

    @field_validator('confirm_password')
    @classmethod
    def validate_passwords_match(cls, v: str, info: ValidationInfo) -> str:
        if 'password' in info.data and v != info.data['password']:
            raise ValueError('Passwords do not match')
        return v

    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v:str):
        # format from (555) 555-5555 to 5555555555
        digits_only = re.sub(r'\D', '', v)
        if not digits_only.isdigit() or len(digits_only) != 10:
                raise ValueError('phone number must contain exactly 10 digits')
        return digits_only

if __name__ == "__main__":
    test_user = {
  "first_name": "",
  "last_name": "karki",
  "email": "nk@example.com",
  "username": "nk69",
  "password": "BoBoboys67@67",
  "confirm_password": "BoBoboys67@67",
  #"phone": "6767667676"
  "phone": "(555) 555-5555"
}

    #test model
    try:
        UserSignup(first_name=test_user['first_name'],
                   last_name=test_user['last_name'],
                   email=test_user['email'],
                   username=test_user['username'],
                   password=test_user['password'],
                   confirm_password=test_user['confirm_password'],
                   phone=test_user['phone'])
        print("Validation successful!")
    except Exception as e:
        print(f"Validation Error: {e}")