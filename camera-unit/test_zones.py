"""Offline tests: python3 -m unittest test_zones.py"""

import unittest

from zones import Zone, ZoneCounter, point_in_polygon

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


if __name__ == "__main__":
    unittest.main()
