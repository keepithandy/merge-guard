# Release-candidate gate

The candidate checklist covers platform installation, security/provenance, performance soak, representative examples, migration documentation, and the release-readiness check. Every blocker must be closed or explicitly deferred with an owner and rationale.

Tagging or publishing requires explicit repository-owner approval. The approval record must set `RELEASE_OWNER_APPROVED=true` in the release environment and identify the reviewed commit. Validation commands never tag, publish, create credentials, or require this approval variable; they only prove the candidate is ready for a separate owner decision.
