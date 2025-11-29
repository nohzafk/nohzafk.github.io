---
title: django-migration-notes
post: 2025-03-24-django-migration-notes.md
date: 2025-03-24T16:57:53+0800
tags: [django, programming]
---
# Notes about Django migration generated SQL

I have recently transitioned a service from [Flyway](https://github.com/flyway/flyway) to Django-migration based database management. To ensure a smooth data migration process, I need to verify that the Django-migrations generated DDL is compatible with the existing one.

## pytest-django: how to create empty database for test cases
I am using pytest with the [pytest-django](https://github.com/pytest-dev/pytest-django) plugin to write unit tests that compare the generated raw SQLs. I have two test cases, both of them start with empty database, one test case executes the Flyway migration, the other test case applies Django migrations. If both test cases pass the same assertions of the database, for example database contains certain tables, indexes, enum type, constraints, etc.), I can be confident about the Django migration files.

The issue is that pytest-django creates a test database instance with Django migrations executed by default. The [--no-migrations](https://pytest-django.readthedocs.io/en/latest/database.html#no-migrations-disable-django-migrations) option does not create an empty database instance. Instead, it disables Django migration execution and creates tables by inspecting the Django models.

I would like pytest-django to have an option to disable Django migration execution, allowing for an empty database instance to be created. This would enable me to test the compatibility of my Django migration files more effectively.

### Solution
The solution is to use a custom `django_db_setup` fixture for the test cases.

```python
@pytest.fixture
def django_db_setup(django_db_blocker):
    """Custom db setup that creates a new empty test db without any tables."""

    original_db = connection.settings_dict["NAME"]
    test_db = "test_" + uuid.uuid4().hex[:8]

    # First, connect to default database to create test database
    with django_db_blocker.unblock():
        with connection.cursor() as cursor:
            print(f"CREATE DATABASE {test_db}")
            cursor.execute(f"CREATE DATABASE {test_db}")

    # Update connection settings to use test database
    for alias in connections:
        connections[alias].settings_dict["NAME"] = test_db

    # Close all existing connections
    # force new connection to be created with updated settings
    for alias in connections:
        connections[alias].close()

    yield

    # Restore the default database name
    # so it won't affect other tests
    for alias in connections:
        connections[alias].settings_dict["NAME"] = original_db

    # Close all existing connections
    # force new connection to be created with updated settings
    for alias in connections:
        connections[alias].close()
```


## Django generated foreign key with deferrable constraints

While comparing the generated DDL, i noticed that in Django-generated DDL, foreign key constraints has a `DEFERRABLE INITIALLY DEFERRED`. This constraint means checking is delayed until transaction end.

It allows temporary violations of the foreign key constraint within a transaction, this can be helpful for inserting related records in any order within a transaction.

Django's ORM is designed to work with `deferrable constraints`:
- It can help prevent issues when saving related objects, especially in complex transactions
- Some Django features (like bulk_create with related objects) work better with deferrable constraints

No Downside for Most Applications:
- Deferrable constraints still ensure data integrity by the end of each transaction
- The performance impact is typically negligible
- If a constraint must be checked immediately, it can still enforce it at the application level

So I keep the Django-generated foreign key constraints and consider following two are equivalent
```sql
FOREIGN KEY (manufacturer) REFERENCES organizations(id)

FOREIGN KEY (manufacturer) REFERENCES organizations(id) DEFERRABLE INITIALLY DEFERRED
```