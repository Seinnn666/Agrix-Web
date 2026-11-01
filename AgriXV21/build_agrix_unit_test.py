from docx import Document
from docx.shared import Inches, Pt
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.text.paragraph import Paragraph
from copy import deepcopy
from pathlib import Path

root = Path(r'C:\Users\zach\OneDrive - National University\Documents\GitHub\Agrix-Web\AgriXV21\unit-test-screenshots')
template = Path(r'C:\Users\zach\Downloads\Unit Test Document.docx')
compiled_reference = Path(r'C:\Users\zach\Downloads\UNIT-TESTING-CYC5-WEB_COMPILED.docx')
out = Path(r'C:\Users\zach\OneDrive - National University\Documents\GitHub\Agrix-Web\AgriXV21\AgriX-Web-Unit-Testing-Cycle-5.docx')
# module, component, prep, action, verify, scenarios [(input, expected, actual, status)], screenshot
records = [
('ADMIN MODULE','Login','Open the AgriX website and use an authorized administrator account.','Authenticate the administrator and open the protected administration area.','The credentials are accepted and the administrator route is displayed.', [('Valid administrator sign-in','Administrator dashboard/console opens.','Sign-in succeeded; AdminDashboard opened.','PASSED')],None),
('ADMIN MODULE','Admin Console','Sign in as an administrator and open the admin overview.','Load the administration console and inspect its overview.','The console shell and overview content appear without blocking errors.', [('Open AdminDashboard overview','Admin console opens and displays overview.','AdminDashboard opened (shared Console/Dashboard route). Counts first showed zero/no users, then populated.','OBSERVED — TRANSIENT DATA STATE')],None),
('ADMIN MODULE','Profile','Sign in as an administrator and select Profile.','Open the administrator profile page.','Profile page loads and displays the signed-in account profile.', [('Open administrator profile','Profile details are displayed.','Admin Profile loaded.','PASSED')],None),
('ADMIN MODULE','User Management','Sign in as an administrator and open User Management.','View the user list and available management controls without changing records.','User list and search/actions are visible; no record is changed during this check.', [('Open user list','User rows and controls are displayed.','User Management loaded with user rows, search, and actions. No records were modified.','PASSED — VIEW ONLY')],None),
('ADMIN MODULE','Notification','Sign in as an administrator and open Notifications.','Load the administrator notification view.','The notification list or its empty state is displayed.', [('Open administrator notifications','Notifications page loads and shows messages or an empty state.','Admin Notifications loaded and showed “All caught up / No updates yet.”','PASSED — EMPTY STATE')],None),
('ADMIN MODULE','Dashboard','Sign in as an administrator and view the dashboard.','Load dashboard summary metrics.','Dashboard metrics display and remain consistent after loading.', [('Load dashboard metrics','Summary counts load and remain stable.','Admin dashboard loaded; summary values appeared after a transient zero/no-users state.','PARTIAL — VERIFY METRIC STABILITY')],None),
('CLIENT MODULE','Landing Page','Open the AgriX website while signed out.','Load the public landing page.','Landing content and navigation render.', [('Open website root','Public AgriX landing page is displayed.','Landing page loaded.','PASSED')], 'landing.jpg'),
('CLIENT MODULE','Login','Open the sign-in page and use an authorized client account.','Authenticate and open the protected client area.','Credentials are accepted and the client dashboard opens.', [('Valid client sign-in','Client dashboard opens.','Sign-in succeeded and client dashboard opened.','PASSED')],None),
('CLIENT MODULE','Forgot Password','Open the sign-in page and select Forgot Password.','Open the password recovery form; do not submit a reset request.','Recovery form is displayed and accepts an email input.', [('Open recovery form','Forgot Password form is displayed.','Recovery screen was displayed; reset submission and email delivery were not tested.','PARTIAL — SUBMISSION NOT TESTED')],None),
('CLIENT MODULE','Dashboard','Sign in as a client and load Dashboard.','Inspect dashboard cards, sensor status, and navigation.','Dashboard renders current account state and available monitoring links.', [('Load client dashboard','Dashboard content is displayed.','Dashboard loaded; no sensor readings were available in the account.','PASSED — NO SENSOR DATA')], 'client-dashboard.jpg'),
('CLIENT MODULE','Notification','Sign in as a client and open Notifications.','Load the client notification list.','The list or its empty state is displayed.', [('Open client notifications','Notifications page loads and shows messages or an empty state.','Notifications loaded and showed “All caught up.”','PASSED — EMPTY STATE')], 'client-notifications.jpg'),
('CLIENT MODULE','Profile','Sign in as a client and open Profile.','View the client profile page.','Profile page loads for the signed-in user.', [('Open client profile','Profile details are displayed.','Client Profile loaded. Personal details are visible in the attached screenshot.','PASSED')], 'client-profile.jpg'),
('CLIENT MODULE','Device Sensors','Sign in as a client and open Device & Sensors.','Inspect device connection and current sensor status.','Device status and any available sensor readings are displayed.', [('Open device status','Connected device and current readings display when available.','ESP32 showed Offline; no readings were available. Mold/forecast status was unknown.','BLOCKED — NO LIVE SENSOR DATA')],None),
('CLIENT MODULE','Reading Timeline','Sign in as a client and open Reading Timeline.','View readings for the selected time filter.','Timeline lists readings or clearly shows an empty state.', [('Open timeline for current filter','Readings or a no-data state are displayed.','No readings were available for the selected filter.','BLOCKED — NO TEST DATA')],None),
('CLIENT MODULE','Graph History','Sign in as a client and open Graph History.','Load historical sensor graphs.','Metric graphs load or a clear no-data state is shown without a load error.', [('Open graph history','Historical metrics render or show a no-data state.','Metrics showed “No data yet”; page also displayed “Failed to load readings.”','FAILED — LOAD ERROR OBSERVED')],None),
('CLIENT MODULE','Snapshot Gallery','Sign in as a client and open Snapshot Gallery.','View available stored images and timestamps.','Gallery displays uploaded images or a clear empty state.', [('Open snapshot gallery','Images or a no-images state are displayed.','Gallery showed no images.','BLOCKED — NO TEST DATA')],None),
('CLIENT MODULE','Alert History','Sign in as a client and open Alert History.','View historical sensor alerts.','Alert list or a clear empty state is displayed.', [('Open alert history','Alerts or a no-alerts state are displayed.','No alerts were available.','BLOCKED — NO TEST DATA')],None),
('CLIENT MODULE','Open Monitoring','Sign in as a client and open Monitoring.','Inspect current monitoring status and alert summary.','Monitoring view shows current readings, alerts, and service status.', [('Open monitoring view','Monitoring status and available readings/alerts are displayed.','No sensor readings or unread alerts; API status displayed Online.','PARTIAL — NO LIVE SENSOR DATA')], 'client-open-monitoring.jpg'),
]

def set_cell(cell, text):
    p = cell.paragraphs[0]
    # Keep the template's first run formatting and paragraph properties.
    if p.runs:
        for run in p.runs: run.text = ''
        p.runs[0].text = text
    else:
        p.add_run(text)
    for extra in cell.paragraphs[1:]:
        extra._element.getparent().remove(extra._element)

def remove_all_body_children(doc):
    body = doc._body._element
    for child in list(body):
        if child.tag.endswith('sectPr'): continue
        body.remove(child)

def append_table_xml(doc, tbl_xml):
    doc._body._element.append(deepcopy(tbl_xml))
    return doc.tables[-1]

doc = Document(str(template))
ref_doc = Document(str(compiled_reference))
form_xml = deepcopy(doc.tables[0]._tbl)
sign_xml = deepcopy(doc.tables[1]._tbl)
system_row_xml = deepcopy(ref_doc.tables[0].rows[3]._tr)
remove_all_body_children(doc)
# Keep source page geometry/styles and rebuild each form from the supplied form pattern.
for n, rec in enumerate(records):
    module, component, pre, action, verify, scenarios, shot = rec
    if n:
        p = doc.add_paragraph()
        p.paragraph_format.page_break_before = True
    t = append_table_xml(doc, form_xml)
    old_system_row = t.rows[3]._tr
    old_system_row.addprevious(deepcopy(system_row_xml))
    old_system_row.getparent().remove(old_system_row)
    set_cell(t.cell(0,3), module)
    set_cell(t.cell(1,1), '5')
    set_cell(t.cell(1,3), module)
    set_cell(t.cell(2,1), '5')
    set_cell(t.cell(2,3), component.upper())
    set_cell(t.cell(3,1), '11/01/2026')
    set_cell(t.cell(3,3), 'Web Application')
    set_cell(t.cell(4,1), pre)
    set_cell(t.cell(5,1), action)
    set_cell(t.cell(6,1), verify)
    for i in range(5):
        row = t.rows[8+i]
        if i < len(scenarios):
            item = scenarios[i]
            if isinstance(item,str):
                item = ('Open module screen','Module screen loads and shows current state.', 'Screen loaded; refer to recorded module results.', 'OBSERVED')
            input_text, expected, actual, status = item
        else:
            input_text, expected, actual, status = ('—','—','Not run.','NOT RUN')
        set_cell(row.cells[0], str(i+1))
        set_cell(row.cells[1], input_text)
        set_cell(row.cells[4], expected)
        set_cell(row.cells[5], actual)
        # The reference stores Remarks in an inline status content control
        # after the six physical cells in each scenario row.
        controls = row._tr.xpath('.//w:sdt')
        if controls:
            texts = [node for node in controls[0].iter(qn('w:t'))]
            if texts:
                texts[0].text = status
                for node in texts[1:]: node.text = ''
            else:
                content = controls[0].find(qn('w:sdtContent'))
                p = OxmlElement('w:p'); r = OxmlElement('w:r'); txt = OxmlElement('w:t'); txt.text = status
                r.append(txt); p.append(r); content.append(p)
        if i == 0 and shot:
            p = row.cells[5].add_paragraph()
            p.paragraph_format.space_before = Pt(2)
            p.add_run().add_picture(str(root / shot), width=Inches(1.35))
    append_table_xml(doc, sign_xml)
# document metadata
doc.core_properties.title = 'AgriX Web Application Unit Testing Cycle 5'
doc.core_properties.subject = 'Observed website module checks for AgriX web application'
doc.core_properties.author = 'AgriX Capstone Team'
doc.save(str(out))
print(out)
