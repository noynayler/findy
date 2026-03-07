"""
Tests for seniority classification

Run with: pytest tests/test_seniority.py -v
"""

import pytest
import sys
import os

# Add parent directory to path so we can import seniority
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from seniority import (
    classify_seniority,
    classify_seniority_from_title,
    parse_years_of_experience,
    matches_selected_seniority
)


class TestYearsParsing:
    """Test years of experience parsing"""
    
    def test_single_year(self):
        min_years, max_years = parse_years_of_experience("2+ years of experience")
        assert min_years == 2
        assert max_years is None
    
    def test_range(self):
        min_years, max_years = parse_years_of_experience("3-5 years required")
        assert min_years == 3
        assert max_years == 5
    
    def test_at_least(self):
        min_years, max_years = parse_years_of_experience("at least 4 years")
        assert min_years == 4
        assert max_years is None
    
    def test_minimum(self):
        min_years, max_years = parse_years_of_experience("minimum 5 years")
        assert min_years == 5
        assert max_years is None
    
    def test_multiple_matches_strictest(self):
        # Multiple matches - should pick strictest (highest min)
        min_years, max_years = parse_years_of_experience("2+ years or 3-5 years experience")
        assert min_years == 3  # Strictest minimum
        assert max_years == 5
    
    def test_no_years(self):
        min_years, max_years = parse_years_of_experience("Great opportunity!")
        assert min_years is None
        assert max_years is None


class TestTitleClassification:
    """Test title-based seniority classification"""
    
    def test_intern_title(self):
        assert classify_seniority_from_title("Software Engineering Intern") == "intern"
        assert classify_seniority_from_title("Internship Program") == "intern"
    
    def test_entry_title(self):
        assert classify_seniority_from_title("Entry Level Developer") == "entry"
        assert classify_seniority_from_title("Junior Backend Engineer") == "junior"
        assert classify_seniority_from_title("New Grad Software Engineer") == "entry"
    
    def test_senior_title(self):
        assert classify_seniority_from_title("Senior Software Engineer") == "senior"
        assert classify_seniority_from_title("Sr DevOps Engineer") == "senior"
    
    def test_lead_title(self):
        assert classify_seniority_from_title("Tech Lead") == "lead"
        assert classify_seniority_from_title("Team Lead Engineer") == "lead"
    
    def test_staff_title(self):
        assert classify_seniority_from_title("Staff Software Engineer") == "staff"
    
    def test_principal_title(self):
        assert classify_seniority_from_title("Principal Engineer") == "principal"
    
    def test_manager_title(self):
        assert classify_seniority_from_title("Engineering Manager") == "manager"
        assert classify_seniority_from_title("Head of Engineering") == "manager"
        assert classify_seniority_from_title("VP of Engineering") == "manager"
    
    def test_no_signal(self):
        assert classify_seniority_from_title("Software Engineer") is None


class TestFullClassification:
    """Test full seniority classification (title + description)"""
    
    def test_title_override(self):
        # Title says "Senior" - should override years
        result = classify_seniority(
            title="Senior Backend Engineer",
            description="2+ years of experience"
        )
        assert result["label"] == "senior"
        assert result["min_years"] == 5  # Overridden to 5+ for senior roles
    
    def test_years_only(self):
        # No title signal, but years in description
        result = classify_seniority(
            title="Backend Engineer",
            description="3-5 years of experience required"
        )
        assert result["label"] == "mid"
        assert result["min_years"] == 3
        assert result["max_years"] == 5
    
    def test_entry_level_years(self):
        result = classify_seniority(
            title="Software Developer",
            description="0-2 years of experience"
        )
        assert result["label"] == "junior"
        assert result["min_years"] == 0
        assert result["max_years"] == 2
    
    def test_unknown(self):
        result = classify_seniority(
            title="Software Engineer",
            description="Great opportunity to work on exciting projects"
        )
        assert result["label"] == "unknown"
        assert result["min_years"] is None


class TestSeniorityMatching:
    """Test matching jobs to selected seniority"""
    
    def test_entry_level_match(self):
        job = {
            "title": "Junior Developer",
            "seniority_label": "junior",
            "min_years": 1,
            "max_years": 2
        }
        assert matches_selected_seniority(job, "entry-level", include_unknown=False) == True
    
    def test_entry_level_exclude_senior(self):
        job = {
            "title": "Senior Developer",
            "seniority_label": "senior",
            "min_years": 5
        }
        assert matches_selected_seniority(job, "entry-level", include_unknown=False) == False
    
    def test_junior_match(self):
        job = {
            "title": "Backend Engineer",
            "seniority_label": "junior",
            "min_years": 2
        }
        assert matches_selected_seniority(job, "junior", include_unknown=False) == True
    
    def test_junior_by_years(self):
        job = {
            "title": "Software Engineer",
            "seniority_label": "unknown",
            "min_years": 2
        }
        assert matches_selected_seniority(job, "junior", include_unknown=False) == False  # Unknown excluded
    
    def test_mid_match(self):
        job = {
            "title": "Mid-Level Engineer",
            "seniority_label": "mid",
            "min_years": 4
        }
        assert matches_selected_seniority(job, "mid", include_unknown=False) == True
    
    def test_senior_match(self):
        job = {
            "title": "Senior DevOps Engineer",
            "seniority_label": "senior",
            "min_years": 5
        }
        assert matches_selected_seniority(job, "senior", include_unknown=False) == True
    
    def test_senior_by_years(self):
        job = {
            "title": "Backend Engineer",
            "seniority_label": "unknown",
            "min_years": 6
        }
        assert matches_selected_seniority(job, "senior", include_unknown=False) == False  # Unknown excluded
    
    def test_lead_match(self):
        job = {
            "title": "Tech Lead",
            "seniority_label": "lead"
        }
        assert matches_selected_seniority(job, "lead", include_unknown=False) == True
    
    def test_manager_match(self):
        job = {
            "title": "Engineering Manager",
            "seniority_label": "manager"
        }
        assert matches_selected_seniority(job, "manager", include_unknown=False) == True
    
    def test_unknown_included(self):
        job = {
            "title": "Software Engineer",
            "seniority_label": "unknown",
            "min_years": None
        }
        assert matches_selected_seniority(job, "junior", include_unknown=True) == True
        assert matches_selected_seniority(job, "junior", include_unknown=False) == False
    
    def test_any_seniority(self):
        job = {
            "title": "Senior Engineer",
            "seniority_label": "senior"
        }
        assert matches_selected_seniority(job, "", include_unknown=False) == True
        assert matches_selected_seniority(job, "any", include_unknown=False) == True


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
