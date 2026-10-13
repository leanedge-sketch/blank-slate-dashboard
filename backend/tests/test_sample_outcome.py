import unittest

from app.services.sample_outcome import apply_sample_outcome, classify_sample_result


class SampleOutcomeTest(unittest.TestCase):
    def test_fail_closes_sample_as_lost(self) -> None:
        payload = apply_sample_outcome(
            {"stage": "Sample", "metadata": {"sample_outcome": "fail"}},
            current_stage="Sample",
        )
        self.assertEqual(payload["stage"], "Lost")
        self.assertEqual(payload["close_reason"], "Sample failed")
        self.assertEqual(payload["metadata"]["sample_outcome"], "fail")

    def test_pass_stays_on_sample(self) -> None:
        payload = apply_sample_outcome(
            {"stage": "Sample", "metadata": {"sample_outcome": "pass"}},
            current_stage="Sample",
        )
        self.assertEqual(payload["stage"], "Sample")
        self.assertEqual(payload["metadata"]["sample_outcome"], "pass")

    def test_moving_to_validation_records_pass(self) -> None:
        payload = apply_sample_outcome(
            {"stage": "Validation", "metadata": {}},
            current_stage="Sample",
        )
        self.assertEqual(payload["metadata"]["sample_outcome"], "pass")
        self.assertEqual(payload["stage"], "Validation")

    def test_classify_pending_and_pass(self) -> None:
        self.assertEqual(classify_sample_result("Sample", {}), "pending")
        self.assertEqual(
            classify_sample_result("Sample", {"sample_outcome": "pass"}),
            "pass",
        )
        self.assertEqual(
            classify_sample_result("Lost", {"sample_outcome": "fail"}),
            "fail",
        )
