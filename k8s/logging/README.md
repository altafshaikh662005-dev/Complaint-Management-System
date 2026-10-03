# Kubernetes Logging

## Architecture

The application containers write logs to stdout/stderr. Kubernetes exposes those container logs through the kubelet and API server, so they can be viewed with `kubectl logs`. The same mechanism provides logs from system pods such as CoreDNS. This project uses native Kubernetes log access; no logging agent, Loki instance, or Grafana logging datasource is installed.

## View Application Logs

```sh
kubectl get pods -n default
kubectl logs deployment/complaint-backend --tail=50 --timestamps
kubectl logs deployment/complaint-frontend --tail=50 --timestamps
kubectl logs deployment/mongodb --tail=50 --timestamps
```

Follow a workload's current logs:

```sh
kubectl logs -f deployment/complaint-backend
kubectl logs -f deployment/complaint-frontend
```

The backend emits request records such as `GET /api/health 200`. The frontend Nginx container emits access records for `/` and proxied `/api/health` requests.

## View Kubernetes System Logs

```sh
kubectl logs -n kube-system deployment/coredns --tail=50 --timestamps
kubectl get events -A --sort-by=.lastTimestamp
```

To inspect logs from a particular system pod, list pods in its namespace and pass the pod name to `kubectl logs`.

## Container Restarts

List pods to find the current pod name. If its container restarted and the previous container log is still available:

```sh
kubectl logs <pod-name> --previous
```

## Scope and Limitations

Native Kubernetes logs meet this project's basic logging requirement and keep the application and existing Prometheus/Grafana setup unchanged. Logs are retrieved per pod/container; there is no centralized cross-pod search, log dashboard, or project-managed long-term retention. Availability of older container logs depends on the node runtime's log rotation and whether the pod/container still exists. Loki with a log shipper and a separate Grafana Loki datasource can be added later if centralized retention and querying are required.
