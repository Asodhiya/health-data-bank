import pytest
from pydantic import ValidationError

from app.schemas.data_element_schema import DataElementCreate


def test_numeric_element_allows_unit_and_normalizes_fields():
    payload = DataElementCreate(
        code=" Sleep_Hours ",
        label=" Sleep Hours ",
        datatype="numeric",
        unit=" hrs ",
        description=" nightly sleep ",
    )

    assert payload.code == "sleep_hours"
    assert payload.label == "Sleep Hours"
    assert payload.datatype == "number"
    assert payload.unit == "hrs"
    assert payload.description == "nightly sleep"


@pytest.mark.parametrize("datatype", ["text", "boolean", "date"])
def test_non_numeric_elements_reject_units(datatype):
    with pytest.raises(ValidationError):
        DataElementCreate(
            code="test_element",
            label="Test Element",
            datatype=datatype,
            unit="kg",
        )


def test_invalid_code_is_rejected():
    with pytest.raises(ValidationError):
        DataElementCreate(code="Blood Pressure", label="Blood Pressure")
