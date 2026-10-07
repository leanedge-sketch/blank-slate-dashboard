import unittest

from app.models.enums import BusinessUnit
from app.services.business_unit_service import (
    FALLBACK_BUSINESS_UNITS,
    normalize_business_unit_name,
)


class BusinessUnitTest(unittest.TestCase):
    def test_synresins_is_a_business_unit(self) -> None:
        self.assertEqual(BusinessUnit.SYNRESINS.value, "Synresins")
        self.assertIn("Synresins", BusinessUnit.values())
        self.assertIn("Synresins", FALLBACK_BUSINESS_UNITS)

    def test_normalize_business_unit_name(self) -> None:
        self.assertEqual(normalize_business_unit_name("  Synresins  "), "Synresins")
        self.assertEqual(normalize_business_unit_name("New   Unit"), "New Unit")
        self.assertIsNone(normalize_business_unit_name("   "))
        self.assertIsNone(normalize_business_unit_name(None))
