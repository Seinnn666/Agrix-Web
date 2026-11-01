AgriX Web Unit Test Evidence — Cycle 5
Tested: 11/01/2026
System: Web application, local AgriX web instance

The adjacent AgriX-Web-Unit-Testing-Cycle-5.docx contains one template-style test form for each of the 18 modules listed by the project team. It records the observed result and status for each screen. Prepared By and Performed By signature lines are blank because names/signatures were not provided.

Screenshot files embedded in the report
landing.jpg — Client Landing Page
client-dashboard.jpg — Client Dashboard
client-notifications.jpg — Client Notifications
client-profile.jpg — Client Profile
client-open-monitoring.jpg — Client Open Monitoring

Observed findings
Administrator sign-in succeeded. Admin Console and Admin Dashboard use the same AdminDashboard route in this build. The overview briefly showed zero/no-user values before counts appeared. User Management and both profile views loaded. Client and admin notifications showed empty states. The client device showed ESP32 Offline; no readings, snapshots, or alerts were available. Graph History also displayed “Failed to load readings.” Open Monitoring showed API Online while sensor data was unavailable. Forgot Password form display was observed; reset submission and email delivery were not tested.

Evidence limits
Only the five screenshot files listed above were collected to disk in the previous session. Other screens were observed in the earlier browser session but do not have local image files embedded. Empty data states do not verify data ingestion, sensor behavior, alert generation, snapshot upload, or historical graph loading. No user records were modified.
