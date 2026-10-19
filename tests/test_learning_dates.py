import unittest
from datetime import date
from progress.learning import build_learning_items


class LearningDateTests(unittest.TestCase):
    def test_actual_timestamp_overrides_wrong_day_and_keeps_time(self):
        entries = []
        for index, stamp in enumerate(('2026-10-19T15:00:00+00:00', '2026-10-20T01:00:00+00:00')):
            entries.append(dict(kind='retrieval', element='walk', item_type='vocabulary',
                event_id=str(index), date=f'2026-10-{19+index}', recorded_at=stamp,
                result='unaided', attempt_type='transfer', observed=True,
                context='work' if index else 'home', evidence='I walk.'))
        item = build_learning_items(entries, date(2026, 10, 21))[0]
        self.assertEqual(item['successful_days'], ['2026-10-19'])
        self.assertEqual(item['state'], 'EN PRÁCTICA')
        self.assertEqual(len(item['attempts']), 2)
        self.assertEqual(item['attempts'][1]['recorded_at'], '2026-10-20T01:00:00+00:00')
