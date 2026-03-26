from fastapi import APIRouter

router = APIRouter(prefix="/api/test", tags=["test"])

@router.get("/")
async def test():
    return {"message": "Test endpoint works"}
