"""Offline tests for the Update button helper: python3 -m unittest test_updater.py"""

import unittest

from updater import pull_changed_files

PULL_OUTPUT = """Updating 2b0559e..9c1d2e3
Fast-forward
 camera-unit/monitor.py      | 17 +++++++++++------
 camera-unit/requirements.txt |  1 +
 2 files changed, 12 insertions(+), 6 deletions(-)
"""


class PullOutputTest(unittest.TestCase):
    def test_lists_changed_files(self):
        self.assertEqual(
            pull_changed_files(PULL_OUTPUT),
            ["camera-unit/monitor.py", "camera-unit/requirements.txt"],
        )

    def test_up_to_date_has_no_files(self):
        self.assertEqual(pull_changed_files("Already up to date.\n"), [])


if __name__ == "__main__":
    unittest.main()
