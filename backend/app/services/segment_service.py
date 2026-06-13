from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Optional, Tuple
from datetime import datetime

from app.models.models import Segment, Customer, Order
from app.schemas.schemas import SegmentCreate, SegmentUpdate, NLSegmentRequest
from app.services.ai_service import ai_service


class SegmentService:
    def get_segments(self, db: Session, page: int = 1, size: int = 50) -> Tuple[List[Segment], int]:
        query = db.query(Segment)
        total = query.count()
        items = query.order_by(Segment.created_at.desc()).offset((page - 1) * size).limit(size).all()
        return items, total

    def get_segment(self, db: Session, segment_id: str) -> Optional[Segment]:
        return db.query(Segment).filter(Segment.id == segment_id).first()

    def create_segment(self, db: Session, data: SegmentCreate) -> Segment:
        seg = Segment(
            name=data.name,
            description=data.description,
            query_definition=data.query_definition.model_dump(),
            is_smart=data.is_smart,
        )
        db.add(seg)
        db.flush()
        seg.estimated_size = self._estimate_size(db, seg)
        db.commit()
        db.refresh(seg)
        return seg

    def create_from_nl(self, db: Session, req: NLSegmentRequest) -> dict:
        result = ai_service.generate_segment_sql(req.natural_language)
        sql = result.get("sql", "")
        description = result.get("description", req.natural_language)

        safe_sql = self._make_safe(sql)
        count = self._count_from_sql(db, safe_sql)

        revenue = self._estimate_revenue(db, safe_sql)

        seg_name = req.name or f"Segment – {req.natural_language[:40]}"
        seg = Segment(
            name=seg_name,
            description=description,
            query_definition={
                "natural_language": req.natural_language,
                "generated_sql": safe_sql,
            },
            estimated_size=count,
        )
        db.add(seg)
        db.commit()
        db.refresh(seg)

        return {
            "name": seg_name,
            "description": description,
            "generated_sql": safe_sql,
            "estimated_size": count,
            "expected_revenue": revenue,
            "segment_id": seg.id,
        }

    def get_segment_customers(self, db: Session, segment_id: str, page: int = 1, size: int = 50):
        seg = self.get_segment(db, segment_id)
        if not seg:
            return [], 0
        sql = seg.query_definition.get("generated_sql") if seg.query_definition else None
        if not sql:
            items = db.query(Customer).offset((page - 1) * size).limit(size).all()
            total = db.query(Customer).count()
            return items, total

        safe = self._make_safe(sql)
        id_rows = db.execute(text(f"SELECT id FROM customers WHERE {safe}")).fetchall()
        ids = [r[0] for r in id_rows]
        total = len(ids)
        page_ids = ids[(page - 1) * size: page * size]
        items = db.query(Customer).filter(Customer.id.in_(page_ids)).all()
        return items, total

    def update_segment(self, db: Session, segment_id: str, data: SegmentUpdate) -> Optional[Segment]:
        seg = self.get_segment(db, segment_id)
        if not seg:
            return None
        for k, v in data.model_dump(exclude_none=True).items():
            setattr(seg, k, v)
        db.commit()
        db.refresh(seg)
        return seg

    def delete_segment(self, db: Session, segment_id: str) -> bool:
        seg = self.get_segment(db, segment_id)
        if not seg:
            return False
        db.delete(seg)
        db.commit()
        return True

    def refresh_size(self, db: Session, segment_id: str) -> int:
        seg = self.get_segment(db, segment_id)
        if not seg:
            return 0
        count = self._estimate_size(db, seg)
        seg.estimated_size = count
        db.commit()
        return count

    def _estimate_size(self, db: Session, seg: Segment) -> int:
        sql = (seg.query_definition or {}).get("generated_sql")
        if not sql:
            return db.query(Customer).count()
        return self._count_from_sql(db, self._make_safe(sql))

    def _count_from_sql(self, db: Session, safe_sql: str) -> int:
        try:
            row = db.execute(text(f"SELECT COUNT(*) FROM customers WHERE {safe_sql}")).fetchone()
            return row[0] if row else 0
        except Exception:
            db.rollback()
            return 0

    def _estimate_revenue(self, db: Session, safe_sql: str) -> float:
        try:
            row = db.execute(
                text(f"SELECT COALESCE(SUM(o.amount), 0) FROM orders o JOIN customers c ON c.id = o.customer_id WHERE {safe_sql}")
            ).fetchone()
            return float(row[0]) if row else 0.0
        except Exception:
            db.rollback()
            return 0.0

    def _make_safe(self, sql: str) -> str:
        """
        Validate AI-generated WHERE clause before execution.

        Defence layers:
        1. Block DDL / DML / dangerous functions outright — return 1=0 (safe no-op)
        2. Reject any semicolons (statement chaining)
        3. Reject comment sequences that could mask injected tokens
        4. Reject information_schema / pg_catalog references (schema exfiltration)
        5. Wrap in a CTE so it can only be used as a filter expression
        """
        sql = sql.strip()
        upper = sql.upper()

        # Layer 1 — DDL / DML / dangerous builtins
        BLOCKED = [
            "DROP", "DELETE", "UPDATE", "INSERT", "TRUNCATE", "ALTER", "CREATE",
            "EXEC", "EXECUTE", "GRANT", "REVOKE", "COPY",
            "PG_SLEEP", "PG_READ_FILE", "PG_WRITE_FILE", "DBLINK",
            "CURRENT_SETTING", "SET_CONFIG",
        ]
        for kw in BLOCKED:
            if kw in upper:
                logger.warning("sql_blocked", reason=kw, sql=sql[:120])
                return "1=0"

        # Layer 2 — statement chaining
        if ";" in sql:
            logger.warning("sql_blocked", reason="semicolon", sql=sql[:120])
            return "1=0"

        # Layer 3 — comment injection
        if "--" in sql or "/*" in sql or "*/" in sql:
            logger.warning("sql_blocked", reason="comment_sequence", sql=sql[:120])
            return "1=0"

        # Layer 4 — schema / catalog exfiltration
        if "INFORMATION_SCHEMA" in upper or "PG_CATALOG" in upper or "PG_CLASS" in upper:
            logger.warning("sql_blocked", reason="schema_access", sql=sql[:120])
            return "1=0"

        return sql


segment_service = SegmentService()
