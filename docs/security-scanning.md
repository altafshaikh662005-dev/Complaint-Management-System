# Container Security Scanning

## Purpose and Method

Trivy scans container operating-system packages and supported application dependencies for known vulnerabilities. The host does not have a Trivy CLI installation; scans run in the pinned `aquasec/trivy:0.75.0` Docker image. The scan uses Trivy's vulnerability database as downloaded on the scan date.

No application source, Docker image, Docker Hub credential, or Kubernetes resource was changed for these scans.

## Images Scanned

Both existing Docker Hub release tags were scanned. Their local image IDs and Docker Hub repository digests matched at inspection time.

| Image                                    | Tag      | Digest                                                                    |
| ---------------------------------------- | -------- | ------------------------------------------------------------------------- |
| `altaf096/complaint-management-backend`  | `0.1.14` | `sha256:08ffc22f1fe87934c831fe3e72812b639c9f2226c48c85384253748711cb7c64` |
| `altaf096/complaint-management-frontend` | `0.1.14` | `sha256:12a2997ecc06363674556a5f3dd8b450dcf06290617c55aafc4a5fd89443f9b9` |

## Scan Commands

Run from a machine with Docker available and network access to Docker Hub and Trivy's vulnerability database:

```sh
docker run --rm --volume trivy-cache:/root/.cache aquasec/trivy:0.75.0 image --scanners vuln --severity UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL --no-progress altaf096/complaint-management-backend:0.1.14
docker run --rm --volume trivy-cache:/root/.cache aquasec/trivy:0.75.0 image --scanners vuln --severity UNKNOWN,LOW,MEDIUM,HIGH,CRITICAL --no-progress altaf096/complaint-management-frontend:0.1.14
```

The scan does not use `--ignore-unfixed` or vulnerability suppressions. Jenkins scans the exact locally built, version-tagged images by saving each image as a temporary Docker archive and passing it to the same Trivy image. Archive scanning was verified against both `0.1.14` tags.

## Results

Scanned on 2026-10-02 with Trivy 0.75.0. These are findings, not a clean scan:

| Image             |   Total | CRITICAL |   HIGH | MEDIUM |    LOW | UNKNOWN |
| ----------------- | ------: | -------: | -----: | -----: | -----: | ------: |
| Backend `0.1.14`  |      19 |        0 |     10 |      8 |      1 |       0 |
| Frontend `0.1.14` |     159 |        2 |     42 |     72 |     42 |       1 |
| **Combined**      | **178** |    **2** | **52** | **80** | **43** |   **1** |

Examples reported include backend `pacote` CVE-2026-9496 and `sigstore` CVE-2026-48815 (HIGH), and frontend OpenSSL CVE-2026-31789 (CRITICAL). The full Trivy table output was produced for both scans; findings are not filtered from Jenkins output.

## Jenkins Integration and Gate

The `Trivy Scan` stage runs after `Docker Build` and before `Docker Login`/`Docker Push`. It scans both version-tagged build images, prints all severities, and caches the vulnerability database in the Docker volume `trivy-cache`. Temporary image archives are removed by the existing always-run cleanup. Rollback-only builds skip this scan because they do not build or push images.

The scan currently uses `--exit-code 0` for vulnerability findings. The inspected baseline already contains CRITICAL/HIGH vulnerabilities; making those findings fail the stage now would block the existing release pipeline. Scanner, database, image export, or Docker execution errors still fail the stage. Therefore, a successful stage means the scan completed, not that the images passed a vulnerability gate. Reassess a CRITICAL/HIGH blocking threshold after updating and reviewing the affected base packages and dependencies.

## Limitations

This is a point-in-time image vulnerability scan. Results change as Trivy's database is updated. The pipeline scans built images before publishing; the full Jenkins pipeline was not triggered during this change, but both archive-based scan commands were run against the existing release images. Trivy requires Docker and network access to obtain its scanner image and vulnerability database.
