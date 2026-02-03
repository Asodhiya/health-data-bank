import re
from typing import Any, Dict, List

#Checks the format of the fields before passing to the authentication
class FormValidator:
    @staticmethod
    def validate_required_fields(data: Dict[str, Any], required_fields: List[str]):
        """
        check if fields are missing:
        1st parameter: dict(key,value),
        2nd parameter: (keys of dict) - we will use to compare
        """
        missing = []
        for field in required_fields: #2nd parameters are the keys of dictionary
            if field not in data or data[field] is None or str(data[field]).strip() == "":
                #checks if field is empty/whitespace/or keys in dict not found
                missing.append(field)
        return missing #if missing is populated, error is found. (lists out missing field)

    @staticmethod
    def validate_email(email: str):
        """
        check email format
        """
        # test@test.test (MUST LOOK LIKE)
        email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        return bool(re.match(email_regex, email))

    @staticmethod
    def validate_password_strength(password: str, min_length: int = 8):
        """
        check password format (checks length, 1 uppercase, 1 lowercase, 1 number, 1 special char)
        """
        errors = []
        if len(password) < min_length:
            errors.append(f"Password must be at least {min_length} characters long.")
        if not re.search(r"[A-Z]", password):
            errors.append("Password must contain at least one uppercase letter.")
        if not re.search(r"[a-z]", password):
            errors.append("Password must contain at least one lowercase letter.")
        if not re.search(r"[0-9]", password):
            errors.append("Password must contain at least one digit.")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", password):
            errors.append("Password must contain at least one special character.")
        return errors #Error lists missing special character

    @staticmethod
    def validate_username(username: str):
        """
        check username format
        """
        #not allowed: spaces, hyphens, periods, @ signs, special chars, slashes, etc.
        return bool(re.match(r'^[a-zA-Z0-9_]+$', username))

if __name__ == "__main__":
    #test
    test_user = { #simulate JSON format
        "username": "user_name!",
        "email": "test@test.test",
        "password": "Password123!",
        "age": ""
    }
    user_keys = list(test_user) #get keys only

    # 1. Check Required Fields
    validate_test = FormValidator.validate_required_fields(test_user, user_keys)
    print(f"Missing Fields: {validate_test}")
    # 2. Check Email
    print(f"Email Valid? {FormValidator.validate_email(test_user['email'])}") # True
    # 3. Check Password
    weakness = FormValidator.validate_password_strength(test_user['password'])
    print(f"Password Issues: {weakness}")
    # 4. Check Username
    print(f"Username Valid? {FormValidator.validate_username(test_user['username'])}")

    test_survey = { #simulate JSON format in a survey test
        "question_1": "a",
        "question_2": "b",
        "question_3": "c",
        "question_4": ""
    }
    # 1. Check Required Fields
    keys_list = list(test_survey)
    validate_test2 = FormValidator.validate_required_fields(test_survey, keys_list)
    print(f"Missing Fields: {validate_test2}")
