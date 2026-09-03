# Backend Requirements: Lead Branch Management

This document provides the technical requirements, schema modifications, and API/Cloud Functions specifications for implementing the **Branch** field across Firestore collections, lead creation, and lead updates.

---

## 1. Standardized Branch List

All branch names have been formatted with Title Case (first letter capital):

1. `Chandigarh`
2. `Gurgaon`
3. `Faridabad`
4. `Kanpur`
5. `Lucknow`
6. `Indore`
7. `Patna`
8. `Raipur`
9. `Jamshedpur`
10. `Mumbai`
11. `Bhadrak`
12. `Cuttack`
13. `Kolkata`
14. `Chandrasekharpur BBSR`
15. `Kharvel Nagar BBSR`
16. `Ashoknagar BBSR`
17. `Guwahati`
18. `Agartala`

### JSON Enum Array for Backend Validation
```json
[
  "Chandigarh",
  "Gurgaon",
  "Faridabad",
  "Kanpur",
  "Lucknow",
  "Indore",
  "Patna",
  "Raipur",
  "Jamshedpur",
  "Mumbai",
  "Bhadrak",
  "Cuttack",
  "Kolkata",
  "Chandrasekharpur BBSR",
  "Kharvel Nagar BBSR",
  "Ashoknagar BBSR",
  "Guwahati",
  "Agartala"
]
```

---

## 2. Firestore Schema Changes

### Collection: `leads/{leadId}`

Add the following field to the `leads` documents:

| Field | Type | Required | Default | Description |
| :--- | :--- | :--- | :--- | :--- |
| `branch` | `string` \| `null` | No | `null` | Assigned branch name from the allowed list |
| `branchUpdatedAt` | `string` (ISO) \| `Timestamp` | No | `null` | Timestamp when the branch was last changed |
| `branchUpdatedBy` | `string` | No | `null` | User ID or display name of the person who updated the branch |

#### Example Lead Document:
```json
{
  "id": "lead_1725358000000",
  "name": "Ritesh",
  "phone": "+919646506916",
  "status": "new",
  "branch": "Chandigarh",
  "branchUpdatedAt": "2026-09-03T11:02:30.000Z",
  "branchUpdatedBy": "Super Admin",
  "source": "Direct WhatsApp",
  "assigneeId": "agent_123",
  "assigneeName": "Agent Name",
  "createdAt": "2026-09-03T11:00:00.000Z",
  "updatedAt": "2026-09-03T11:02:30.000Z"
}
```

---

## 3. Lead Ingestion & Creation APIs

### 3.1 Manual Lead Creation (`createNewLead` / CRM API)
- Accept `branch` in the request payload.
- Validate that the provided `branch` belongs to the standardized branch list (or is `null`/empty).
- Persist `branch: payload.branch || null` to `leads/{leadId}`.

### 3.2 Meta Ads & WhatsApp Webhook Auto-Creation
- When a lead is automatically created via inbound WhatsApp webhook or Meta Ad Form Webhook:
  - If the Ad metadata/Form responses include city/branch information, normalize and map to one of the 18 standardized branches.
  - If no branch is provided or matching fails, set `branch: null`.

---

## 4. Lead Update API (`updateLeadBranch`)

Create or update the endpoint/callable Cloud Function to handle inline branch updates from the CRM:

### Request Payload:
```json
{
  "leadId": "lead_1725358000000",
  "branch": "Mumbai",
  "updatedBy": "Super Admin"
}
```

### Backend Logic:
1. Validate `branch` against the allowed branch list.
2. Update `leads/{leadId}` document:
   ```javascript
   await db.collection('leads').doc(leadId).update({
     branch: branch || null,
     branchUpdatedAt: new Date().toISOString(),
     branchUpdatedBy: updatedBy || 'System',
     updatedAt: new Date().toISOString()
   });
   ```
3. If `conversations/{leadId}` collection exists, keep the `branch` field synchronized.
4. *(Optional)* Add an audit log entry in `audit_logs` collection:
   ```json
   {
     "action": "lead_branch_updated",
     "leadId": "lead_1725358000000",
     "previousBranch": "Chandigarh",
     "newBranch": "Mumbai",
     "performedBy": "Super Admin",
     "timestamp": "2026-09-03T11:02:30.000Z"
   }
   ```

---

## 5. Security Rules (`firestore.rules`)

Ensure authenticated CRM users can read and write the `branch` field:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /leads/{leadId} {
      allow read, write: if request.auth != null;
    }
    match /conversations/{leadId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

---

## 6. Composite Indexes (`firestore.indexes.json`)

If leads will be filtered by branch on the backend server:

```json
{
  "indexes": [
    {
      "collectionGroup": "leads",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "branch", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "leads",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "branch", "order": "ASCENDING" },
        { "fieldPath": "createdAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```
