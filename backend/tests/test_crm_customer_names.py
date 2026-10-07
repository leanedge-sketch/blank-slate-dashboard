import unittest

from app.services.crm_service import customer_names_are_duplicates


class CustomerNameDuplicateTest(unittest.TestCase):
    def test_same_company_with_legal_suffix(self) -> None:
        self.assertTrue(
            customer_names_are_duplicates(
                "Sika Abyssinia",
                "Sika Abyssinia Chemicals PLC",
            )
        )

    def test_shared_word_is_not_a_duplicate(self) -> None:
        self.assertFalse(
            customer_names_are_duplicates("MIX CHEMICALS", "NAF IMPORT AND EXPORT PLC")
        )
        self.assertFalse(
            customer_names_are_duplicates(
                "MIX CHEMICALS",
                "Co fix Ethiopia construction chemicals",
            )
        )

    def test_short_query_is_not_a_duplicate(self) -> None:
        self.assertFalse(customer_names_are_duplicates("C", "MIX CHEMICALS"))
        self.assertFalse(customer_names_are_duplicates("PLC", "NAF IMPORT AND EXPORT PLC"))
