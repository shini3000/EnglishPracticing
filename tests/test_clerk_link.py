"""Admin linking never guesses ownership or moves another user's progress."""

import importlib.util
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import AsyncMock, MagicMock
from uuid import UUID

spec = importlib.util.spec_from_file_location(
    'clerk_link', Path(__file__).resolve().parents[1] / 'scripts/link_clerk_learner.py'
)
linker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(linker)


class ClerkLinkTests(unittest.IsolatedAsyncioTestCase):
    async def test_dry_run_and_apply(self):
        learner = UUID('00000000-0000-0000-0000-000000000001')
        conn = SimpleNamespace(
            transaction=MagicMock(), fetch=AsyncMock(return_value=[{'id': learner, 'clerk_user_id': None}]),
            execute=AsyncMock(),
        )
        self.assertIn('Dry-run', await linker.link(conn, learner, 'user_a', False))
        conn.execute.assert_not_called()
        self.assertIn('preserved', await linker.link(conn, learner, 'user_a', True))
        conn.execute.assert_awaited_once()
        self.assertEqual(conn.execute.call_args.args[1:], ('user_a', learner))

    async def test_rejects_missing_and_conflicting_ownership(self):
        learner = UUID('00000000-0000-0000-0000-000000000001')
        other = UUID('00000000-0000-0000-0000-000000000002')
        for rows in ([], [{'id': learner, 'clerk_user_id': 'user_other'}], [
            {'id': learner, 'clerk_user_id': None}, {'id': other, 'clerk_user_id': 'user_a'},
        ]):
            conn = SimpleNamespace(transaction=MagicMock(), fetch=AsyncMock(return_value=rows), execute=AsyncMock())
            with self.assertRaises(ValueError):
                await linker.link(conn, learner, 'user_a', True)
            conn.execute.assert_not_called()

    async def test_same_binding_is_idempotent(self):
        learner = UUID('00000000-0000-0000-0000-000000000001')
        conn = SimpleNamespace(transaction=MagicMock(),
            fetch=AsyncMock(return_value=[{'id': learner, 'clerk_user_id': 'user_a'}]), execute=AsyncMock())
        self.assertIn('Already linked', await linker.link(conn, learner, 'user_a', True))
        conn.execute.assert_not_called()
