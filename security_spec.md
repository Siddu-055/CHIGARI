# Chigari Bus Services - Security Specification

## 1. Data Invariants
- A `User` profile must match the `request.auth.uid`.
- Only `admin` role can modify roles of other users.
- `Dispatcher` role can update bus locations and route assignments.
- `Passenger` role (default) has read-only access to routes and schedules.
- `Anonymous` users can read routes and schedules.

## 2. The Dirty Dozen Payloads
1. **Identity Spoofing**: Attempt to create a user profile with a different `uid`.
2. **Privilege Escalation**: A `passenger` trying to update their own `role` to `admin`.
3. **Route Sabotage**: A `passenger` trying to delete a `route`.
4. **Dispatcher Overreach**: A `dispatcher` trying to delete a `user`.
5. **Bus Hijacking**: An `anonymous` user trying to update a `bus` location.
6. **Ghost Users**: Creating a user without a valid email.
7. **Shadow Roles**: Injecting a role like `super-admin` which is not in the enum.
8. **Resource Exhaustion**: Sending a 1MB string for a route name.
9. **Relational Sync Break**: Assigning a bus to a `routeId` that doesn't exist.
10. **Time Poisoning**: Sending a future timestamp for `updatedAt`.
11. **Orphaned Writes**: Updating a bus location without being a dispatcher.
12. **Admin Lockdown**: Attempting to delete the last admin (soft check via rules).

## 3. Test Runner
(Placeholder for actual test file if environment supported it)
