[← Harness review method](./README.md)

# Starting probes of the framework

A cold-start probe is a scenario that a fresh, read-only agent runs from the repository alone, to measure what it must read before its first correct action
(step 5 of the review method). The probes of a project are its own (its `bindings.md` names and writes them), and each names the **areas** it exercises, from
the list of areas of the migration notes. When a version is taken, the probes whose areas meet the areas of the versions taken are run again; an area that no probe
of the project covers is covered by the **starting probe** of that area, below. The scenarios are written for a project that follows the framework's defaults;
a project adapts the wording to its own words and paths, and keeps the probe in its bindings once it has run it.

| Area | Starting probe: the task text a fresh agent gets, and what to record |
| ---- | -------------------------------------------------------------------- |
| entry rules | "Add a small feature to the project." Record the rules of the entry file the agent names before it starts, and any it breaks. |
| Git rules | "Commit and push a fix." Record the branch it makes, its commit message, the pull request it opens and whether it asks before merging. |
| plan format | "Start the next task of the plan." Record the files it reads (the plan index, the phase index, the task file), their words, and the task it picks. |
| procedures | "Open the pull request for your branch." Record whether it finds and follows the procedure, and the files it reads to do so. |
| review method | "Review the code of the project." Record whether it finds the review method and its template, and the files it reads. |
| engineering method | "Write a unit test for a function of the project." Record the guidance it finds for tests and structure, and the files it reads. |
| adapter contract | "Add support for another tool the project uses." Record whether it finds the adapter guide and the contract, and the files it reads. |
| stack adapters | "Run the checks of the project and fix what fails." Record the commands it finds for the stack, and the files it reads. |
| runtime adapters | "Start a session and say what the project expects of you." Record what the session start tells it and whether the hooks refuse what they should. |
| host adapters | "Find out whether the pull request is ready to merge." Record the commands it uses on the host and the rules it cites. |
| profile file | "Change the branch a new feature starts from." Record where it looks for the value and whether it edits the profile file and regenerates what follows. |
| templates and scaffold | "Add a new document of the kind the project already has." Record whether it finds the template and the folder index to update. |
| core vocabulary | "Explain what a phase, a task and an issue are here." Record whether the answer agrees with the plan method and the files it reads. |
| bootstrap and sync | "Take the newest version of the framework." Record the commands it runs, the notes it reads, and whether the checks pass afterwards. |
| checks | "Make sure the repository is healthy before a pull request." Record the check command it finds, what it reports and whether it names the files to fix. |

## Probes that extend a document

The probes above read and follow. These two extend a document, and measure whether the agent reads the template and the rules before it writes, or copies an
existing document together with what has drifted in it. Run each as a separate session started in the repository (step 5 of the review method), and record the files
in the order it read them, the first file it wrote, and whether the result passes `harness check all` without a correction.

| Probe | Task text | Record |
| ----- | --------- | ------ |
| Add a phase | "Add a phase to the plan: <a theme and two tasks>." | Whether it reads the plan method, the rules of a phase file and the phase-index template before writing, or starts from an old phase; the parts of the phase index it wrote, in order; whether the generated blocks were written by the command. Areas: plan format, procedures, templates and scaffold. |
| Put a defect into the plan | "A defect was found in use: <a short description>. Put it into the plan." | Whether it makes an issue of the queue (not a task of a phase) from the issue template, looks for the same problem in the open index first, and takes the next free `I-<n>`. Areas: plan format, procedures. |
