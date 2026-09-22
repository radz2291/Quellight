# Q6 recovery: private fixture identity

Date: 2026-09-22. Additive clarification to D-Q6-15, committed alone before
changing the fixture boundary. The new owner instruction prohibits hashing
private fixture text, superseding the historical SHA-256 fixture procedure.

Keep the original fixture bytes only in the parent's memory and compare them
directly after worker exit. Use filesystem identity and modification metadata
(device, inode, size, modification and change time) to detect replacement or
mutation between parent validation and worker adoption; check these around each
read. Send only that metadata to the child. Do not compute, serialize or report
a content digest. Result records expose byte length only. Neither fixture text
nor its path enters logs or reports. The private input still necessarily crosses
the authorized provider ingress and disposable conversation store for the proof.

The path, UTF-8, size, operator-data exclusion, repository exclusion, read-only
treatment, parent cleanup ordering and changed-fixture refusal remain mandatory.
The fixture must remain unchanged throughout the proof. This protects against
ordinary concurrent modification; it does not claim protection against an
adversary who can modify the file and forge filesystem metadata during execution.
