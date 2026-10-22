"""Offline tests: python3 -m unittest test_zones.py"""

import unittest

from zones import Confirmer, Zone, ZoneCounter, point_in_polygon

SQUARE = [(0, 0), (10, 0), (10, 10), (0, 10)]


class PointInPolygonTest(unittest.TestCase):
    def test_inside_and_outside(self):
        self.assertTrue(point_in_polygon((5, 5), SQUARE))
        self.assertFalse(point_in_polygon((15, 5), SQUARE))
        self.assertFalse(point_in_polygon((5, -1), SQUARE))

    def test_concave(self):
        l_shape = [(0, 0), (10, 0), (10, 4), (4, 4), (4, 10), (0, 10)]
        self.assertTrue(point_in_polygon((2, 8), l_shape))
        self.assertFalse(point_in_polygon((8, 8), l_shape))

    def test_degenerate(self):
        self.assertFalse(point_in_polygon((1, 1), [(0, 0), (1, 1)]))


class DwellTest(unittest.TestCase):
    def setUp(self):
        self.table = Zone("t", "Table", "seating", 4, SQUARE)
        self.line = Zone("l", "Line", "line", None, [(20, 0), (30, 0), (30, 10), (20, 10)])
        self.counter = ZoneCounter(dwell_s=600)

    def test_live_counts(self):
        counts = self.counter.count([self.table, self.line], [(5, 5), (6, 6), (25, 5)], now=0)
        self.assertEqual(counts, {"t": 2, "l": 1})

    def test_seating_holds_after_people_leave(self):
        self.counter.count([self.table], [(5, 5), (6, 6)], now=0)
        self.assertEqual(self.counter.count([self.table], [], now=100)["t"], 2)
        self.assertEqual(self.counter.count([self.table], [], now=599)["t"], 2)
        self.assertEqual(self.counter.count([self.table], [], now=600)["t"], 0)

    def test_line_does_not_hold(self):
        self.counter.count([self.line], [(25, 5)], now=0)
        self.assertEqual(self.counter.count([self.line], [], now=1)["l"], 0)

    def test_new_people_reset_dwell(self):
        self.counter.count([self.table], [(5, 5)], now=0)
        self.counter.count([self.table], [(5, 5), (6, 6), (7, 7)], now=500)
        self.assertEqual(self.counter.count([self.table], [], now=1000)["t"], 3)


class LatestFrameTest(unittest.TestCase):
    def test_newest_frame_wins_and_close_wakes(self):
        from main import LatestFrame

        slot = LatestFrame()
        self.assertIsNone(slot.take(timeout=0.01))
        slot.put("a")
        slot.put("b")
        self.assertEqual(slot.take(timeout=0.01), "b")
        self.assertIsNone(slot.take(timeout=0.01))
        slot.close()
        self.assertIsNone(slot.take(timeout=1.0))


class ConfirmerPendingTest(unittest.TestCase):
    def test_pending_reports_value_and_deadline(self):
        c = Confirmer(confirm_s=5)
        c.update({"a": 0}, now=100.0)
        c.update({"a": 2}, now=101.0)
        self.assertEqual(c.pending(), {"a": (2, 106.0)})
        c.update({"a": 2}, now=106.0)
        self.assertEqual(c.pending(), {})
        self.assertEqual(c.stable["a"], 2)


class ConfirmerTest(unittest.TestCase):
    def test_first_sight_is_immediate(self):
        c = Confirmer(confirm_s=5)
        self.assertEqual(c.update({"a": 2}, now=100), ({"a": 2}, True))

    def test_change_waits_for_the_hold(self):
        c = Confirmer(confirm_s=5)
        c.update({"a": 0}, now=100)
        self.assertEqual(c.update({"a": 1}, now=101), ({"a": 0}, False))
        self.assertEqual(c.update({"a": 1}, now=105), ({"a": 0}, False))
        self.assertEqual(c.update({"a": 1}, now=106), ({"a": 1}, True))

    def test_walk_through_never_shows(self):
        c = Confirmer(confirm_s=5)
        c.update({"a": 0}, now=100)
        c.update({"a": 1}, now=101)
        c.update({"a": 1}, now=103)
        self.assertEqual(c.update({"a": 0}, now=104), ({"a": 0}, False))
        # The timer starts over when the person comes back.
        c.update({"a": 1}, now=105)
        self.assertEqual(c.update({"a": 1}, now=109), ({"a": 0}, False))
        self.assertEqual(c.update({"a": 1}, now=110), ({"a": 1}, True))

    def test_zones_are_independent(self):
        c = Confirmer(confirm_s=5)
        c.update({"a": 0, "b": 0}, now=100)
        c.update({"a": 1, "b": 0}, now=101)
        c.update({"a": 1, "b": 3}, now=104)
        self.assertEqual(c.update({"a": 1, "b": 3}, now=106), ({"a": 1, "b": 0}, True))
        self.assertEqual(c.update({"a": 1, "b": 3}, now=109), ({"a": 1, "b": 3}, True))

    def test_frames_also_required(self):
        c = Confirmer(confirm_s=0, confirm_frames=2)
        c.update({"a": 0}, now=100)
        self.assertEqual(c.update({"a": 1}, now=100.1), ({"a": 0}, False))
        self.assertEqual(c.update({"a": 1}, now=100.2), ({"a": 1}, True))

    def test_deleted_zone_drops_out(self):
        c = Confirmer(confirm_s=5)
        c.update({"a": 0, "b": 1}, now=100)
        self.assertEqual(c.update({"a": 0}, now=101)[0], {"a": 0})


if __name__ == "__main__":
    unittest.main()
