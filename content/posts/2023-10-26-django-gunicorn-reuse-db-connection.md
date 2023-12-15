---
title: Django and Gunicorn - Reuse Database Connections
date: 2023-10-26
tags: [django, gunicorn]
---

## Introduction

In a Django application deployed with gunicorn, it is important to optimize the handling of database connections to improve performance and efficiency. This post explores the behavior of gunicorn in relation to database connections and provides insights on how to reuse connections effectively.

## Django + Gunicorn

Improtant note about Django ORM is that Django ORM does not have a build-int database connection pool like `SQLAlchemy`. The lifetime of the persistant connections are controlled by the [`CONN_MAX_AGE`](https://docs.djangoproject.com/en/4.2/ref/databases/#persistent-connections), the default value is `0`.

### The Sync Worker Class

In the case where `CONN_MAX_AGE` is set to 0, a new database connection is created for every HTTP request and closed at the end of each request. This can potentially lead to increased overhead due to the constant creation and closure of connections.

However, if `CONN_MAX_AGE` is set to a value greater than 0, the database connection is not closed immediately after the request is finished. In gunicorn's sync worker class, which is process-based with a fixed number of processes, subsequent requests will be processed by the same processes, keeping the number of database connections stable.

### The Async Worker Class: `eventlet` and `gevent`

For the default case where `CONN_MAX_AGE` is 0, there are no issues as connections are closed at the end of each request.

However, if `CONN_MAX_AGE` is not 0, problems can arise. In gunicorn's async worker class, such as `eventlet` and `gevent`, each new HTTP request creates a new greenlet thread to handle it. Each thread maintains its own connection, leading to an accumulation of database connections over time.

To tackle this issue, the official gunicorn documentation recommends using the `gevent` worker and activating greenlet support for Psycopg2 when connecting to PostgreSQL. This can be achieved using the [psycogreen](https://bitbucket.org/dvarrazzo/psycogreen) library.

## References

For more information, refer to the following resources:

- [Gunicorn Design: Async Workers](https://docs.gunicorn.org/en/stable/design.html#async-workers)
- [Django Conn_Max_Age Persists Connections But Doesn't Reuse Them with PostgreSQL](https://serverfault.com/questions/635100/django-conn-max-age-persists-connections-but-doesnt-reuse-them-with-postgresq)
- [Gunicorn Issue: Reusing Database Connections](https://github.com/benoitc/gunicorn/issues/996)
