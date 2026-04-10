"""
Data Elements & Field Mapping Routes (Researcher)

This module exposes REST endpoints for managing data elements and the
mappings between survey form fields and those elements.  All routes
require a logged-in researcher with the appropriate permission.

Data flow
---------
FormField  →  FieldElementMap  →  DataElement
                   ↓
            (on survey submit)
                   ↓
            HealthDataPoint

A form field only produces a HealthDataPoint when it has an active
mapping.  An optional ``transform_rule`` stored on the mapping is
applied at projection time to convert the raw answer into the
element's expected unit / format.
"""
from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession
from uuid import UUID

from app.db.session import get_db
from app.core.dependency import require_permissions
from app.core.permissions import ELEMENT_VIEW, ELEMENT_CREATE, ELEMENT_DELETE, ELEMENT_MAP
from app.db.queries.Queries import DataElementQuery
from app.schemas.data_element_schema import DataElementCreate, FieldMapPayload

router = APIRouter()


@router.get("/elements", dependencies=[Depends(require_permissions(ELEMENT_VIEW))])
async def list_data_elements(
    include_inactive: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
):
    """Return all active data elements.

    Returns 
    -------
    list[DataElement]
        Every data element where ``is_active`` is ``True``.
    """
    data_element_queries = DataElementQuery(db)
    return await data_element_queries.get_data_elements(include_inactive=include_inactive)


@router.get("/deleted", dependencies=[Depends(require_permissions(ELEMENT_VIEW))])
async def list_deleted_data_elements(db: AsyncSession = Depends(get_db)):
    """Return all soft-deleted data elements."""
    data_element_queries = DataElementQuery(db)
    return await data_element_queries.list_deleted_data_elements()


@router.post("/data_element", dependencies=[Depends(require_permissions(ELEMENT_CREATE))])
async def create_data_element(payload: DataElementCreate, db: AsyncSession = Depends(get_db)):
    """Create a new data element.

    Parameters
    ----------
    payload : DataElementCreate
        ``code`` (required, unique), plus optional ``label``,
        ``datatype``, ``unit``, and ``description``.

    Returns
    -------
    DataElement
        The newly created record.

    Raises
    ------
    409
        If a data element with the same ``code`` already exists.
    """
    data_element_queries = DataElementQuery(db)
    return await data_element_queries.add_data_element(payload)


@router.get("/all-mappings", dependencies=[Depends(require_permissions(ELEMENT_VIEW))])
async def get_all_mappings(db: AsyncSession = Depends(get_db)):
    """Return every field→element mapping with form and field labels in one query."""
    q = DataElementQuery(db)
    return await q.get_all_field_mappings()


@router.get("/{element_id}", dependencies=[Depends(require_permissions(ELEMENT_VIEW))])
async def get_data_element(element_id: UUID, db: AsyncSession = Depends(get_db)):
    """Fetch a single data element by its UUID.

    Parameters
    ----------
    element_id : UUID
        Primary key of the data element.

    Returns
    -------
    DataElement | None
    """
    data_element_queries = DataElementQuery(db)
    element = await data_element_queries.get_data_element(element_id)
    return element


@router.delete("/{element_id}", dependencies=[Depends(require_permissions(ELEMENT_DELETE))])
async def delete_data_element(element_id: UUID, db: AsyncSession = Depends(get_db)):
    """Permanently delete a data element.

    Parameters
    ----------
    element_id : UUID
        Primary key of the data element to delete.

    Raises
    ------
    404
        If no element with ``element_id`` exists.
    """
    data_element_queries = DataElementQuery(db)
    return await data_element_queries.delete_data_element(element_id)


@router.post("/{element_id}/restore", dependencies=[Depends(require_permissions(ELEMENT_DELETE))])
async def restore_data_element(element_id: UUID, db: AsyncSession = Depends(get_db)):
    """Restore a soft-deleted data element."""
    data_element_queries = DataElementQuery(db)
    return await data_element_queries.restore_data_element(element_id)


@router.post("/fields/{field_id}/map", dependencies=[Depends(require_permissions(ELEMENT_MAP))])
async def map_field_to_element(field_id: UUID, payload: FieldMapPayload, db: AsyncSession = Depends(get_db)):
    """Map a form field to a data element.

    Creates a ``FieldElementMap`` row linking ``field_id`` to
    ``payload.element_id``.  The optional ``transform_rule`` dict is
    stored as-is and applied at survey-submission time to convert the
    raw answer value before it is written to ``health_data_points``.

    Parameters
    ----------
    field_id : UUID
        The ``form_fields.field_id`` to map.
    payload : FieldMapPayload
        ``element_id`` (required) and optional ``transform_rule`` dict.

    Returns
    -------
    FieldElementMap
        The newly created mapping record.

    Raises
    ------
    409
        If ``field_id`` is already mapped to ``element_id``.
    """
    q = DataElementQuery(db)
    return await q.map_field(field_id, payload.element_id, payload.transform_rule)


@router.delete("/fields/{field_id}/map", dependencies=[Depends(require_permissions(ELEMENT_MAP))])
async def unmap_field(field_id: UUID, element_id: UUID, db: AsyncSession = Depends(get_db)):
    """Remove the mapping between a form field and a data element.

    Parameters
    ----------
    field_id : UUID
        Path parameter — the form field to unmap.
    element_id : UUID
        Query parameter — the specific data element to unlink.

    Raises
    ------
    404
        If no mapping exists for the given ``field_id`` / ``element_id`` pair.
    """
    q = DataElementQuery(db)
    await q.unmap_field(field_id, element_id)


@router.get("/fields/{field_id}/map", dependencies=[Depends(require_permissions(ELEMENT_VIEW))])
async def get_field_mapping(field_id: UUID, db: AsyncSession = Depends(get_db)):
    """Return all data element mappings for a form field.

    Parameters
    ----------
    field_id : UUID
        The form field whose mappings are requested.

    Returns
    -------
    list[tuple[FieldElementMap, DataElement]]
        Each row contains the mapping record (including ``transform_rule``)
        and the joined ``DataElement`` details.
    """
    q = DataElementQuery(db)
    return await q.get_field_mappings(field_id)
