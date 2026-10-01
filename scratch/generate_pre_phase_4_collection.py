import json
import os

collection = {
    "info": {
        "name": "Codebase Intellisense - Pre Phase 4 Verification",
        "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
    },
    "item": [
        {
            "name": "01 - Authentication",
            "item": [
                {
                    "name": "GET Current User (Valid User A)",
                    "request": {
                        "method": "GET",
                        "header": [{"key": "Cookie", "value": "session_id={{session_a}}"}],
                        "url": {"raw": "{{base_url}}/auth/me", "host": ["{{base_url}}"], "path": ["auth", "me"]}
                    },
                    "event": [
                        {"listen": "test", "script": {"exec": [
                            "pm.test('Status code is 200', function () { pm.response.to.have.status(200); });",
                            "pm.test('Response matches User A ID', function () { pm.expect(pm.response.json().id).to.eql(pm.environment.get('user_a_id')); });"
                        ]}}
                    ]
                },
                {
                    "name": "GET Current User (No Cookie)",
                    "request": {
                        "method": "GET",
                        "header": [],
                        "url": {"raw": "{{base_url}}/auth/me", "host": ["{{base_url}}"], "path": ["auth", "me"]}
                    },
                    "event": [
                        {"listen": "test", "script": {"exec": [
                            "pm.test('Status code is 401', function () { pm.response.to.have.status(401); });"
                        ]}}
                    ]
                },
                {
                    "name": "GET Current User (Invalid Cookie)",
                    "request": {
                        "method": "GET",
                        "header": [{"key": "Cookie", "value": "session_id=invalid_cookie_123"}],
                        "url": {"raw": "{{base_url}}/auth/me", "host": ["{{base_url}}"], "path": ["auth", "me"]}
                    },
                    "event": [
                        {"listen": "test", "script": {"exec": [
                            "pm.test('Status code is 401', function () { pm.response.to.have.status(401); });"
                        ]}}
                    ]
                }
            ]
        },
        {
            "name": "02 - Repository API",
            "item": [
                {
                    "name": "GET Repositories (User A)",
                    "request": {
                        "method": "GET",
                        "header": [{"key": "Cookie", "value": "session_id={{session_a}}"}],
                        "url": {"raw": "{{base_url}}/repositories", "host": ["{{base_url}}"], "path": ["repositories"]}
                    },
                    "event": [
                        {"listen": "test", "script": {"exec": [
                            "pm.test('Status code is 200', function () { pm.response.to.have.status(200); });",
                            "var data = pm.response.json();",
                            "pm.test('Contains repo_a', function () { ",
                            "   var found = data.items.find(r => r.id === pm.environment.get('repo_a_id'));",
                            "   pm.expect(found).to.not.be.undefined;",
                            "});"
                        ]}}
                    ]
                },
                {
                    "name": "GET Repository Detail (User A -> Repo A)",
                    "request": {
                        "method": "GET",
                        "header": [{"key": "Cookie", "value": "session_id={{session_a}}"}],
                        "url": {"raw": "{{base_url}}/repositories/{{repo_a_id}}", "host": ["{{base_url}}"], "path": ["repositories", "{{repo_a_id}}"]}
                    },
                    "event": [
                        {"listen": "test", "script": {"exec": [
                            "pm.test('Status code is 200', function () { pm.response.to.have.status(200); });",
                            "pm.test('ID matches', function () { pm.expect(pm.response.json().id).to.eql(pm.environment.get('repo_a_id')); });"
                        ]}}
                    ]
                },
                {
                    "name": "GET Repository Detail (Invalid UUID)",
                    "request": {
                        "method": "GET",
                        "header": [{"key": "Cookie", "value": "session_id={{session_a}}"}],
                        "url": {"raw": "{{base_url}}/repositories/not-a-uuid", "host": ["{{base_url}}"], "path": ["repositories", "not-a-uuid"]}
                    },
                    "event": [
                        {"listen": "test", "script": {"exec": [
                            "pm.test('Status code is 422', function () { pm.response.to.have.status(422); });"
                        ]}}
                    ]
                },
                {
                    "name": "GET Repository Detail (Non-existent)",
                    "request": {
                        "method": "GET",
                        "header": [{"key": "Cookie", "value": "session_id={{session_a}}"}],
                        "url": {"raw": "{{base_url}}/repositories/00000000-0000-0000-0000-000000000000", "host": ["{{base_url}}"], "path": ["repositories", "00000000-0000-0000-0000-000000000000"]}
                    },
                    "event": [
                        {"listen": "test", "script": {"exec": [
                            "pm.test('Status code is 404', function () { pm.response.to.have.status(404); });"
                        ]}}
                    ]
                },
                {
                    "name": "POST Connect Repository (Github Auth Environment Blocked)",
                    "request": {
                        "method": "POST",
                        "header": [
                            {"key": "Cookie", "value": "session_id={{session_a}}"},
                            {"key": "Content-Type", "value": "application/json"}
                        ],
                        "body": {
                            "mode": "raw",
                            "raw": "{\"url\": \"https://github.com/owner/repo\"}"
                        },
                        "url": {"raw": "{{base_url}}/repositories", "host": ["{{base_url}}"], "path": ["repositories"]}
                    },
                    "event": [
                        {"listen": "test", "script": {"exec": [
                            "pm.test('Status code is 400 or 502', function () { pm.expect(pm.response.code).to.be.oneOf([400, 502]); });"
                        ]}}
                    ]
                }
            ]
        },
        {
            "name": "03 - Repository Authorization (Multi-Tenant)",
            "item": [
                {
                    "name": "User A -> Repo B (Denied)",
                    "request": {
                        "method": "GET",
                        "header": [{"key": "Cookie", "value": "session_id={{session_a}}"}],
                        "url": {"raw": "{{base_url}}/repositories/{{repo_b_id}}", "host": ["{{base_url}}"], "path": ["repositories", "{{repo_b_id}}"]}
                    },
                    "event": [
                        {"listen": "test", "script": {"exec": [
                            "pm.test('Status code is 404', function () { pm.response.to.have.status(404); });"
                        ]}}
                    ]
                },
                {
                    "name": "User B -> Repo A (Denied)",
                    "request": {
                        "method": "GET",
                        "header": [{"key": "Cookie", "value": "session_id={{session_b}}"}],
                        "url": {"raw": "{{base_url}}/repositories/{{repo_a_id}}", "host": ["{{base_url}}"], "path": ["repositories", "{{repo_a_id}}"]}
                    },
                    "event": [
                        {"listen": "test", "script": {"exec": [
                            "pm.test('Status code is 404', function () { pm.response.to.have.status(404); });"
                        ]}}
                    ]
                },
                {
                    "name": "No Auth -> Repo A (Denied)",
                    "request": {
                        "method": "GET",
                        "header": [],
                        "url": {"raw": "{{base_url}}/repositories/{{repo_a_id}}", "host": ["{{base_url}}"], "path": ["repositories", "{{repo_a_id}}"]}
                    },
                    "event": [
                        {"listen": "test", "script": {"exec": [
                            "pm.test('Status code is 401', function () { pm.response.to.have.status(401); });"
                        ]}}
                    ]
                }
            ]
        },
        {
            "name": "04 - Repository Analysis",
            "item": [
                {
                    "name": "POST Analyze (Github Auth Environment Blocked)",
                    "request": {
                        "method": "POST",
                        "header": [
                            {"key": "Cookie", "value": "session_id={{session_a}}"},
                            {"key": "Content-Type", "value": "application/json"}
                        ],
                        "body": {
                            "mode": "raw",
                            "raw": "{\"branch\": \"main\"}"
                        },
                        "url": {"raw": "{{base_url}}/repositories/{{repo_a_id}}/analyze", "host": ["{{base_url}}"], "path": ["repositories", "{{repo_a_id}}", "analyze"]}
                    },
                    "event": [
                        {"listen": "test", "script": {"exec": [
                            "pm.test('Status code is 502 or 400', function () { pm.expect(pm.response.code).to.be.oneOf([400, 502]); });"
                        ]}}
                    ]
                }
            ]
        },
        {
            "name": "05 - Repository Jobs",
            "item": [
                {
                    "name": "GET Jobs (User A -> Repo A)",
                    "request": {
                        "method": "GET",
                        "header": [{"key": "Cookie", "value": "session_id={{session_a}}"}],
                        "url": {"raw": "{{base_url}}/repositories/{{repo_a_id}}/jobs", "host": ["{{base_url}}"], "path": ["repositories", "{{repo_a_id}}", "jobs"]}
                    },
                    "event": [
                        {"listen": "test", "script": {"exec": [
                            "pm.test('Status code is 200', function () { pm.response.to.have.status(200); });",
                            "var data = pm.response.json();",
                            "pm.test('Response is array', function () { pm.expect(Array.isArray(data)).to.be.true; });"
                        ]}}
                    ]
                },
                {
                    "name": "GET Job Detail (User A -> Job A)",
                    "request": {
                        "method": "GET",
                        "header": [{"key": "Cookie", "value": "session_id={{session_a}}"}],
                        "url": {"raw": "{{base_url}}/repositories/{{repo_a_id}}/jobs/{{job_a_id}}", "host": ["{{base_url}}"], "path": ["repositories", "{{repo_a_id}}", "jobs", "{{job_a_id}}"]}
                    },
                    "event": [
                        {"listen": "test", "script": {"exec": [
                            "pm.test('Status code is 200', function () { pm.response.to.have.status(200); });",
                            "var data = pm.response.json();",
                            "pm.test('Status is READY', function () { pm.expect(data.status).to.eql('READY'); });"
                        ]}}
                    ]
                },
                {
                    "name": "User B -> Job A (Denied)",
                    "request": {
                        "method": "GET",
                        "header": [{"key": "Cookie", "value": "session_id={{session_b}}"}],
                        "url": {"raw": "{{base_url}}/repositories/{{repo_a_id}}/jobs/{{job_a_id}}", "host": ["{{base_url}}"], "path": ["repositories", "{{repo_a_id}}", "jobs", "{{job_a_id}}"]}
                    },
                    "event": [
                        {"listen": "test", "script": {"exec": [
                            "pm.test('Status code is 404', function () { pm.response.to.have.status(404); });"
                        ]}}
                    ]
                }
            ]
        },
        {
            "name": "06 - Repository Versions",
            "item": [
                {
                    "name": "GET Versions (User A -> Repo A)",
                    "request": {
                        "method": "GET",
                        "header": [{"key": "Cookie", "value": "session_id={{session_a}}"}],
                        "url": {"raw": "{{base_url}}/repositories/{{repo_a_id}}/versions", "host": ["{{base_url}}"], "path": ["repositories", "{{repo_a_id}}", "versions"]}
                    },
                    "event": [
                        {"listen": "test", "script": {"exec": [
                            "pm.test('Status code is 200', function () { pm.response.to.have.status(200); });",
                            "var data = pm.response.json();",
                            "pm.test('Response is array', function () { pm.expect(Array.isArray(data)).to.be.true; });"
                        ]}}
                    ]
                },
                {
                    "name": "GET Active Version (User A -> Repo A)",
                    "request": {
                        "method": "GET",
                        "header": [{"key": "Cookie", "value": "session_id={{session_a}}"}],
                        "url": {"raw": "{{base_url}}/repositories/{{repo_a_id}}/versions/active", "host": ["{{base_url}}"], "path": ["repositories", "{{repo_a_id}}", "versions", "active"]}
                    },
                    "event": [
                        {"listen": "test", "script": {"exec": [
                            "pm.test('Status code is 200', function () { pm.response.to.have.status(200); });",
                            "var data = pm.response.json();",
                            "pm.test('Index status is SUCCESS', function () { pm.expect(data.status).to.eql('SUCCESS'); });"
                        ]}}
                    ]
                },
                {
                    "name": "User B -> Repo A Active Version (Denied)",
                    "request": {
                        "method": "GET",
                        "header": [{"key": "Cookie", "value": "session_id={{session_b}}"}],
                        "url": {"raw": "{{base_url}}/repositories/{{repo_a_id}}/versions/active", "host": ["{{base_url}}"], "path": ["repositories", "{{repo_a_id}}", "versions", "active"]}
                    },
                    "event": [
                        {"listen": "test", "script": {"exec": [
                            "pm.test('Status code is 404', function () { pm.response.to.have.status(404); });"
                        ]}}
                    ]
                }
            ]
        },
        {
            "name": "07 - Logout",
            "item": [
                {
                    "name": "POST Logout User A",
                    "request": {
                        "method": "POST",
                        "header": [{"key": "Cookie", "value": "session_id={{session_a}}"}],
                        "url": {"raw": "{{base_url}}/auth/logout", "host": ["{{base_url}}"], "path": ["auth", "logout"]}
                    },
                    "event": [
                        {"listen": "test", "script": {"exec": [
                            "pm.test('Status code is 204 or 200', function () { pm.expect(pm.response.code).to.be.oneOf([200, 204]); });"
                        ]}}
                    ]
                },
                {
                    "name": "GET Current User (User A after logout)",
                    "request": {
                        "method": "GET",
                        "header": [{"key": "Cookie", "value": "session_id={{session_a}}"}],
                        "url": {"raw": "{{base_url}}/auth/me", "host": ["{{base_url}}"], "path": ["auth", "me"]}
                    },
                    "event": [
                        {"listen": "test", "script": {"exec": [
                            "pm.test('Status code is 401', function () { pm.response.to.have.status(401); });"
                        ]}}
                    ]
                }
            ]
        }
    ]
}

with open(os.path.join(os.path.dirname(__file__), 'pre_phase_4_collection.json'), 'w') as f:
    json.dump(collection, f, indent=2)

print("Collection created successfully at scratch/pre_phase_4_collection.json")
