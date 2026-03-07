let resumeText = null;

document.getElementById('uploadResumeBtn').addEventListener('click', async () => {
    const fileInput = document.getElementById('resume');
    const file = fileInput.files[0];
    const statusSpan = document.getElementById('resumeStatus');
    if (!file) {
        statusSpan.textContent = 'Please select a file';
        statusSpan.className = 'resume-status error';
        return;
    }
    const formData = new FormData();
    formData.append('resume', file);
    try {
        statusSpan.textContent = 'Uploading...';
        statusSpan.className = 'resume-status';
        const response = await fetch('/api/resume/upload', { method: 'POST', body: formData });
        const data = await response.json();
        if (data.success) {
            resumeText = data.resume_text;
            statusSpan.textContent = '✓ Resume uploaded (' + data.text_length + ' chars)';
            statusSpan.className = 'resume-status success';
        } else {
            statusSpan.textContent = 'Error: ' + (data.error || 'Upload failed');
            statusSpan.className = 'resume-status error';
            resumeText = null;
        }
    } catch (err) {
        statusSpan.textContent = 'Error: ' + err.message;
        statusSpan.className = 'resume-status error';
        resumeText = null;
    }
});

document.getElementById('searchBtn').addEventListener('click', async () => {
    const title = document.getElementById('title').value.trim();
    const seniority = document.getElementById('seniority').value;
    const loading = document.getElementById('loading');
    const error = document.getElementById('error');
    const jobsList = document.getElementById('jobsList');
    const jobCount = document.getElementById('jobCount');
    const totalJobCount = document.getElementById('totalJobCount');
    const filterNote = document.getElementById('filterNote');
    const totalJobsSection = document.getElementById('totalJobsSection');

    loading.classList.remove('hidden');
    error.classList.add('hidden');
    jobsList.innerHTML = '';

    try {
        const requestBody = { days: 7 };
        if (title) requestBody.title = title;
        if (seniority) requestBody.seniority = seniority;
        if (resumeText) requestBody.resume_text = resumeText;

        const timeoutMs = resumeText ? 360000 : 300000;
        const controller = new AbortController();
        const timeoutId = setTimeout(function () { controller.abort(); }, timeoutMs);

        const response = await fetch('/api/jobs/search', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
            var errorMsg = 'HTTP error! status: ' + response.status;
            try {
                var errorData = await response.json();
                errorMsg = errorData.error || errorMsg;
            } catch (e) {
                errorMsg = await response.text() || errorMsg;
            }
            throw new Error(errorMsg);
        }

        const data = await response.json();
        loading.classList.add('hidden');

        if (data.success) {
            if (data.total_count !== undefined) {
                totalJobCount.textContent = data.total_count;
                totalJobsSection.classList.remove('hidden');
            }
            displayJobs(data.jobs, data.matched, data.total_count, data.filtered, title, seniority);
        } else {
            showError(data.error || 'Failed to fetch jobs');
        }
    } catch (err) {
        loading.classList.add('hidden');
        var errorMsg;
        if (err.name === 'AbortError') {
            errorMsg = 'Request timed out. Try again or use fewer filters.';
        } else if (err.message === 'Failed to fetch' || err.message === 'Load failed') {
            errorMsg = 'Cannot reach the server. Open http://localhost:5000 and run: python -m backend.main';
        } else {
            errorMsg = err.message || 'Something went wrong.';
        }
        showError('Error: ' + errorMsg);
    }
});

function esc(s) {
    if (s == null || s === undefined) return '';
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function displayJobs(jobs, matched, totalCount, filtered, titleFilter, seniorityFilter) {
    const jobCount = document.getElementById('jobCount');
    const filterNote = document.getElementById('filterNote');
    const jobsList = document.getElementById('jobsList');

    jobCount.textContent = jobs.length;
    if (filtered && totalCount !== null) {
        var parts = [];
        if (titleFilter) parts.push('role: "' + titleFilter + '"');
        if (seniorityFilter) parts.push('seniority: ' + seniorityFilter);
        filterNote.textContent = 'Showing ' + jobs.length + ' of ' + totalCount + ' total jobs (filtered by ' + parts.join(', ') + ')';
    } else if (totalCount !== null) {
        filterNote.textContent = 'Showing all ' + totalCount + ' jobs from the last 7 days';
    }

    if (jobs.length === 0) {
        jobsList.innerHTML = '<p class="no-jobs">No jobs found. Try adjusting your filters.</p>';
        return;
    }

    jobsList.innerHTML = jobs.map(function (job) {
        try {
            var matchScore = (matched && job.match_score != null) ? '<div class="match-score">Match: ' + Number(job.match_score) + '%</div>' : '';
            var matchSkills = Array.isArray(job.matching_skills) ? job.matching_skills : (job.matched_keywords || []);
            var missSkills = Array.isArray(job.missing_skills) ? job.missing_skills : (job.missing_keywords || []);
            var matchingSkills = (matched && matchSkills.length > 0) ? '<div class="skills matching-skills"><strong>Matching:</strong> ' + esc(matchSkills.join(', ')) + '</div>' : '';
            var missingSkills = (matched && missSkills.length > 0) ? '<div class="skills missing-skills"><strong>Missing:</strong> ' + esc(missSkills.join(', ')) + '</div>' : '';
            var seniorityLabel = job.seniority_label || 'unknown';
            var seniorityDisplay = seniorityLabel.charAt(0).toUpperCase() + seniorityLabel.slice(1);
            var yearsDisplay = '';
            if (job.min_years != null) {
                yearsDisplay = (job.max_years != null) ? job.min_years + '-' + job.max_years + ' years' : job.min_years + '+ years';
            }
            var reasonEsc = esc(job.seniority_reason || '');
            var seniorityBadge = '<div class="seniority-badge" data-seniority="' + esc(seniorityLabel) + '" title="' + reasonEsc + '"><span class="seniority-label">' + esc(seniorityDisplay) + '</span>' + (yearsDisplay ? '<span class="years-range">' + esc(yearsDisplay) + '</span>' : '') + (job.seniority_reason ? '<span class="seniority-reason" title="' + reasonEsc + '">ℹ️</span>' : '') + '</div>';
            var dateDisplay = job.date_posted ? new Date(job.date_posted).toLocaleDateString() : 'Date unknown';
            var jobUrl = job.url || '#';
            var jobTitle = job.title || 'Job';
            return '<div class="job-card"><h3><a href="' + esc(jobUrl) + '" target="_blank" rel="noopener">' + esc(jobTitle) + '</a></h3><p class="company">' + esc(job.company || '') + '</p><p class="location">📍 ' + esc(job.location || 'Location not specified') + '</p><p class="date">📅 ' + esc(dateDisplay) + '</p>' + seniorityBadge + matchScore + matchingSkills + missingSkills + '<p class="source">Source: ' + esc(job.source || '') + '</p></div>';
        } catch (err) {
            return '<div class="job-card"><p>Error showing this job.</p></div>';
        }
    }).join('');
}

function showError(message) {
    var el = document.getElementById('error');
    el.textContent = message;
    el.classList.remove('hidden');
}
