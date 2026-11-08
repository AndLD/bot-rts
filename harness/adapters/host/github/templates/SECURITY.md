# Security policy

## Supported versions

Fixes for security problems go to the latest release of <%= project.title %>, which is built from the `<%= branches.production %>` branch. An older release gets no fix of its own: take the latest one.

## Reporting a vulnerability

Report a weakness in private, not in a public issue, a pull request or a discussion:

1. Open the **Security** tab of this repository and choose **Report a vulnerability** (the private vulnerability reporting of GitHub).
2. Say what is affected (a version, a file or a feature), how to reproduce the problem, and what an attacker gains. Leave out real secrets and other people's data.

Only the maintainers of the repository can read a private report.

## What happens to a report

- A maintainer acknowledges the report within 7 days and says whether it is accepted as a vulnerability.
- The fix is made in private when the report is accepted, and the release that carries it names the problem in its changelog. The reporter is credited unless they ask not to be.
- A report that is not accepted gets the reason.

## What is public

The issue queue and the reports of users are public, so anything that is not a vulnerability (a defect, a question, a request) belongs there. If you are not sure that a problem is a vulnerability, report it in private; a maintainer will move it to the public queue if it is not one.
