import json
import os
from datetime import datetime
from typing import List, Dict, Optional

class MemoryStorage:
    def __init__(self, filepath="myraa_memory.json"):
        self.filepath = filepath
        self._ensure_file()

    def _ensure_file(self):
        if not os.path.exists(self.filepath):
            with open(self.filepath, "w") as f:
                json.dump([], f)

    def load_all(self) -> List[Dict]:
        try:
            with open(self.filepath, "r") as f:
                return json.load(f)
        except Exception:
            return []

    def save_all(self, data: List[Dict]):
        with open(self.filepath, "w") as f:
            json.dump(data, f, indent=2)

class MemoryManager:
    def __init__(self, storage: MemoryStorage):
        self.storage = storage

    def remember(self, key: str, value: str, context: Optional[str] = None) -> Dict:
        data = self.storage.load_all()

        # Check for duplicates or updates
        existing = next((item for item in data if item["key"] == key), None)

        timestamp = datetime.utcnow().isoformat()

        if existing:
            existing["value"] = value
            if context:
                existing["context"] = context
            existing["updated_at"] = timestamp
            result = existing
        else:
            result = {
                "id": str(len(data) + 1),
                "key": key,
                "value": value,
                "context": context,
                "created_at": timestamp,
                "updated_at": timestamp
            }
            data.append(result)

        self.storage.save_all(data)
        return result

    def forget(self, key: str) -> bool:
        data = self.storage.load_all()
        initial_length = len(data)
        data = [item for item in data if item["key"] != key]

        if len(data) < initial_length:
            self.storage.save_all(data)
            return True
        return False

    def search(self, query: str) -> List[Dict]:
        data = self.storage.load_all()
        query = query.lower()
        results = []
        for item in data:
            if query in item["key"].lower() or query in item["value"].lower() or (item.get("context") and query in item["context"].lower()):
                results.append(item)
        return results

    def get_all(self) -> List[Dict]:
        return self.storage.load_all()

    def format_memory_for_prompt(self) -> str:
        data = self.get_all()
        if not data:
            return "No specific long-term memories stored yet."

        memory_lines = ["--- CORE MEMORY BANK ---"]
        for item in data:
            memory_lines.append(f"- {item['key']}: {item['value']}")

        return "\n".join(memory_lines)
