import bcrypt

class PasswordHash:
    __slots__ = ("_value",)

    def __init__(self, value: bytes):
        self._value = value

    @classmethod
    def from_password(cls, password: str, rounds: int = 12):
        hashed = bcrypt.hashpw(
            password.encode("utf-8"),
            bcrypt.gensalt(rounds)
        )
        return cls(hashed)

    def verify(self, password: str) -> bool:
        return bcrypt.checkpw(
            password.encode("utf-8"),
            self._value
        )

    def to_str(self) -> str:
        return self._value.decode("utf-8")

    @classmethod
    def from_str(cls, value: str):
        return cls(value.encode("utf-8"))
    

