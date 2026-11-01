from docx import Document
from docx.shared import Inches, Pt, RGBColor
from docx.enum.section import WD_ORIENT
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.enum.table import WD_TABLE_ALIGNMENT, WD_CELL_VERTICAL_ALIGNMENT
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from pathlib import Path

OUT = Path(r'C:\Users\zach\OneDrive - National University\Documents\GitHub\Agrix-Web\AgriX_Web_Unit_Testing_Instructions_Cycle_5.docx')
NAVY='17324D'; GREEN='2C6E59'; PALE='EAF2F4'; GOLD='F0B429'; LIGHT='F6F8FA'; BORDER='B8C6CF'; TEXT='243746'; MUTED='5A6B78'

def shade(cell, fill):
    pr=cell._tc.get_or_add_tcPr(); shd=pr.find(qn('w:shd'))
    if shd is None: shd=OxmlElement('w:shd'); pr.append(shd)
    shd.set(qn('w:fill'), fill)

def borders(table, color=BORDER, size='6'):
    tblPr=table._tbl.tblPr; b=tblPr.find(qn('w:tblBorders'))
    if b is None: b=OxmlElement('w:tblBorders'); tblPr.append(b)
    for edge in ('top','left','bottom','right','insideH','insideV'):
        e=b.find(qn('w:'+edge))
        if e is None: e=OxmlElement('w:'+edge); b.append(e)
        e.set(qn('w:val'),'single'); e.set(qn('w:sz'),size); e.set(qn('w:color'),color)

def set_cell_margins(cell, top=75, start=100, bottom=75, end=100):
    tc=cell._tc; tcPr=tc.get_or_add_tcPr(); mar=tcPr.first_child_found_in('w:tcMar')
    if mar is None: mar=OxmlElement('w:tcMar'); tcPr.append(mar)
    for m,v in [('top',top),('start',start),('bottom',bottom),('end',end)]:
        node=mar.find(qn('w:'+m))
        if node is None: node=OxmlElement('w:'+m); mar.append(node)
        node.set(qn('w:w'),str(v)); node.set(qn('w:type'),'dxa')

def format_run(run, size=9, bold=False, color=TEXT, font='Aptos'):
    run.font.name=font; run._element.rPr.rFonts.set(qn('w:eastAsia'),font); run.font.size=Pt(size); run.bold=bold; run.font.color.rgb=RGBColor.from_string(color)

def add_text(cell, text, bold=False, color=TEXT, size=8.6):
    cell.text=''; p=cell.paragraphs[0]; p.paragraph_format.space_after=Pt(0); p.paragraph_format.space_before=Pt(0); p.paragraph_format.line_spacing=1.05
    r=p.add_run(text); format_run(r,size,bold,color)
    cell.vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER; set_cell_margins(cell)

def add_labeled_row(table, label, value, label_fill=PALE, value_fill='FFFFFF', height=None):
    cells=table.add_row().cells
    cells[0].width=Inches(2.05); cells[1].width=Inches(8.55)
    shade(cells[0],label_fill); shade(cells[1],value_fill)
    add_text(cells[0],label,True,NAVY,8.3); add_text(cells[1],value,False,TEXT,8.6)
    return cells

D=Document(); sec=D.sections[0]; sec.orientation=WD_ORIENT.LANDSCAPE; sec.page_width=Inches(11); sec.page_height=Inches(8.5); sec.top_margin=Inches(.55); sec.bottom_margin=Inches(.55); sec.left_margin=Inches(.7); sec.right_margin=Inches(.7)
styles=D.styles
styles['Normal'].font.name='Aptos'; styles['Normal'].font.size=Pt(10); styles['Normal'].font.color.rgb=RGBColor.from_string(TEXT)

# Header and footer
header=sec.header.paragraphs[0]; header.alignment=WD_ALIGN_PARAGRAPH.RIGHT
r=header.add_run('AGRIX  /  WEB APPLICATION QUALITY ASSURANCE'); format_run(r,8,True,GREEN)
footer=sec.footer.paragraphs[0]; footer.alignment=WD_ALIGN_PARAGRAPH.CENTER
r=footer.add_run('Unit Testing Instructions  •  Cycle 5'); format_run(r,8,False,MUTED)

p=D.add_paragraph(); p.paragraph_format.space_after=Pt(3)
r=p.add_run('AgriX Web Application Unit Testing Instructions & Authorization Notice'); format_run(r,23,True,NAVY)
p=D.add_paragraph(); p.paragraph_format.space_after=Pt(12)
r=p.add_run('Admin Portal & Client Web Portal  |  Desktop Browser Test Plan'); format_run(r,11,False,GREEN)

# Authorization callout
T=D.add_table(rows=1, cols=1); T.alignment=WD_TABLE_ALIGNMENT.CENTER; T.autofit=False; T.columns[0].width=Inches(9.6); borders(T,GREEN,'10')
c=T.cell(0,0); shade(c,'F1F7F4'); c.text=''; p=c.paragraphs[0]; p.paragraph_format.space_after=Pt(3)
r=p.add_run('Authorization Notice'); format_run(r,11,True,GREEN)
p=c.add_paragraph(); p.paragraph_format.space_after=Pt(0); p.paragraph_format.line_spacing=1.08
r=p.add_run("The designated tester (friend/team member) is fully authorized and permitted to use the system owner's (Zachary's) computer and development environment to access the AgriX Web Platform (Admin Portal and Client Web Portal), execute test scenarios, and capture web interface screenshots for the official Unit Test Documentation."); format_run(r,9.5,False,TEXT)

D.add_paragraph().paragraph_format.space_after=Pt(0)
p=D.add_paragraph(); p.paragraph_format.space_after=Pt(5)
r=p.add_run('Test Documentation Format & Guidelines'); format_run(r,15,True,NAVY)
p=D.add_paragraph(); p.paragraph_format.space_after=Pt(5)
r=p.add_run('Complete one test record for each scenario. Enter the actual execution date, record observed behavior, attach or paste a screenshot in the result box, and mark the final status. Keep all evidence focused on the website in a desktop browser.'); format_run(r,9.5)

fields=['Module Name (e.g., ADMIN WEB PORTAL / CLIENT WEB PORTAL)','Component Name (e.g., ADMIN CONSOLE / USER MANAGEMENT / DEVICE SENSORS WEB)','Test Cycle No.: Cycle 5 (or current cycle)','Date Tested: [Date]','Type of System: Web Application (Desktop Browser)','Pre-conditions & Action Description','Verification Steps & Scenario Inputs','Expected Results','Actual Results (Screenshot placeholder box)','Remarks (PASSED / FAILED)']
T=D.add_table(rows=1, cols=1); T.alignment=WD_TABLE_ALIGNMENT.CENTER; T.autofit=False; T.columns[0].width=Inches(10.6); borders(T)
c=T.cell(0,0); shade(c,NAVY); add_text(c,'REQUIRED FIELDS IN EACH TEST CASE',True,'FFFFFF',9)
for f in fields:
    row=T.add_row().cells; row[0].width=Inches(10.6); add_text(row[0],'•  '+f,False,TEXT,8.7)
    if len(T.rows)%2==0: shade(row[0],LIGHT)

p=D.add_paragraph(); p.paragraph_format.space_before=Pt(10); p.paragraph_format.space_after=Pt(3)
r=p.add_run('AgriX Web System Modules & Components to Test (Strictly Website Focus)'); format_run(r,15,True,NAVY)
p=D.add_paragraph(); p.paragraph_format.space_after=Pt(0)
r=p.add_run('The test cases below follow the web application modules in the AgriX user module architecture. Mobile application flows are outside this plan.'); format_run(r,9.5,False,MUTED)

cases=[
('ADMIN WEB PORTAL','LOGIN & AUTH FLOW','Confirm credential validation and role-based web routing.', 'Open the admin sign-in page. Submit empty, invalid, and valid admin credentials. If available, sign in with a non-admin account to confirm role handling.', 'Required-field and invalid-credential feedback appears. A valid admin is routed directly to the Admin Control Panel web page. A non-admin account is denied admin access or routed to its authorized client page.', 'Sign-in form; error feedback; destination URL/page; access control outcome.'),
('ADMIN WEB PORTAL','ADMIN CONTROL PANEL / CONSOLE','Check system status widgets, top navigation integration, and hamburger menu overlay.', 'Sign in as an administrator. Inspect status widgets and navigation. Open and close the hamburger dropdown overlay; select each available menu destination.', 'Widgets render without broken or missing data states. Navigation links resolve to the intended admin web pages. The menu overlay opens, is usable, and closes through its supported controls.', 'Widget labels and displayed states; menu open/close behavior; links and resulting pages.'),
('ADMIN WEB PORTAL','PROFILE & NAVIGATION','Verify profile display/edit behavior and Back button routing.', 'From the Admin Control Panel, open Profile. Record current visible details, edit an allowed field, save, refresh, then use the Back control.', 'Profile details display correctly. Valid edits save and persist after refresh; invalid values are rejected with useful feedback. Back returns directly to the Admin Control Panel.', 'Profile values before/after; save feedback; refresh persistence; Back destination.'),
('ADMIN WEB PORTAL','USER MANAGEMENT TABLE','Verify registered names, search/filter, status updates, and removal of Farmer/Farm Owner role badges.', 'Open User Management. Compare displayed names with known registered web users. Search and filter records, update a user status if permitted, and inspect role badges for Farmer/Farm Owner.', 'Registered users show their actual names rather than “Unnamed.” Search/filter returns matching rows. Status changes persist. Farmer/Farm Owner role badges are absent where removal is expected.', 'Known test user records; search term/filter; status before/after; role badge observation.'),
('ADMIN WEB PORTAL','ADMIN NOTIFICATIONS','Verify admin-isolated feed, unread count, read state, and delete action.', 'Open Admin Notifications. Compare items and unread count before/after opening a notification. Mark a notification read and delete a designated test alert.', 'Only admin-scoped alerts are shown. Unread badge count matches unread items and updates after reading. Read state persists. Delete removes the selected alert from the feed.', 'Feed contents; unread count; selected alert; state changes and deletion result.'),
('ADMIN WEB PORTAL','ADMIN DASHBOARD','Check overview metrics, web analytics, and operational summary.', 'Open the Admin Dashboard. Review each high-level metric, chart, analytics panel, and operational summary. Refresh and compare displayed values or states.', 'Dashboard sections load with labels and values; charts render; summary information is internally consistent with the displayed reporting period and available system data. Empty states are clear when no data exists.', 'Metric labels/values; reporting period; chart rendering; observed empty or error states.'),
('CLIENT WEB PORTAL','LANDING PAGE','Verify showcase hero section, web navigation header, and footer.', 'Open the client web landing page at desktop browser size. Inspect hero content, primary calls to action, header links, and footer links.', 'Hero section and content render without clipping. Header navigation and calls to action resolve to expected web destinations. Footer is present and links work.', 'Browser size; hero and navigation elements; tested destinations.'),
('CLIENT WEB PORTAL','LOGIN & PASSWORD RESET','Verify member authentication forms, OTP modal, and account recovery flow.', 'Open client login. Try required-field and invalid credentials, then use valid test-member credentials. Exercise OTP verification and password recovery using authorized test accounts and channels.', 'Validation feedback is clear; invalid login is rejected; valid member can authenticate. OTP modal opens and accepts valid code while rejecting invalid/expired code. Recovery flow provides expected confirmation and allows a valid reset.', 'Test account identifier; masked OTP flow outcome; invalid/valid inputs; reset confirmation and result.'),
('CLIENT WEB PORTAL','CLIENT DASHBOARD','Verify overview metrics and quick navigation links.', 'Sign in as a client member. Open the dashboard, inspect overview cards/metrics, and follow each quick navigation link; return using the page navigation.', 'Dashboard loads for the signed-in member. Metrics have labels and meaningful values or clear empty states. Quick links route to their matching client web modules.', 'Member role; dashboard metrics; each link destination and return path.'),
('CLIENT WEB PORTAL','USER NOTIFICATIONS','Verify user-scoped notifications and automated welcome notification.', 'Sign in with a newly registered or designated test member. Open Notifications and locate the automated “Welcome to AgriX” item. Compare feed visibility with another authorized test account if available.', 'The welcome notification is triggered as specified. Each member sees only their own notifications. Feed content and unread state correspond to that member.', 'Test account(s); welcome item presence; notification ownership and unread state.'),
('CLIENT WEB PORTAL','DEVICE SENSORS WEB — READING TIMELINE','Verify real-time web telemetry logs for ESP32 temperature, humidity, and soil pH.', 'Open Device Sensors > Reading Timeline. Observe incoming or latest readings and compare displayed timestamps, units, and values against the authorized test data source.', 'Temperature, humidity, and soil pH readings are labeled with correct units and timestamps. New data appears according to the configured update interval; unavailable data is represented clearly.', 'Observation window; sensor values/units/timestamps; update interval or empty state.'),
('CLIENT WEB PORTAL','DEVICE SENSORS WEB — GRAPH HISTORY','Verify interactive sensor trend charts and historical web data views.', 'Open Graph History. Select each available sensor and time range. Hover or select chart points, change range, and compare plotted values with corresponding timeline records.', 'Trend lines render for the selected sensor and period. Axes, units, timestamps, and legend are clear. Interactions and range filters update the graph; history agrees with available readings.', 'Sensor and time range; plotted values; interaction/filter result; comparison notes.'),
('CLIENT WEB PORTAL','DEVICE SENSORS WEB — SNAPSHOT GALLERY','Verify uploaded snapshot gallery and image history.', 'Open Snapshot Gallery. Review available captures, timestamps, and thumbnails. Open an image or its detail view and check loading and empty/error states.', 'Gallery displays available images or a clear empty state. Images open at the expected size and timestamps are readable.', 'Image thumbnails and timestamps; image view result; empty/error state if encountered.'),
('CLIENT WEB PORTAL','DEVICE SENSORS WEB — ALERT HISTORY','Verify micro-climate threshold warning alert web logs.', 'Open Alert History. Review recorded threshold warnings and their sensor, value, timestamp, and status. Use available filters or detail links.', 'Warnings appear with correct sensor/context, observed value, threshold, timestamp, and status. Filter/detail actions work and records are readable; no-alert state is clear.', 'Alert record(s); sensor and threshold; timestamp/status; filter/detail result.'),
('CLIENT WEB PORTAL','DEVICE SENSORS WEB — OPEN MONITORING','Verify web live stream and real-time sensor telemetry dashboard.', 'Open Open Monitoring. Confirm the live stream panel and telemetry dashboard load. Observe updates over a defined interval; exercise available pause/reconnect or navigation controls.', 'Live view and telemetry are displayed when a source is available. Values refresh as configured; stream interruptions and unavailable sensor states are communicated. Controls respond and the page remains navigable.', 'Observation interval; stream status; telemetry values/update behavior; control and error-state results.'),
]

for idx,(module,component,objective,actions,expected,verify) in enumerate(cases,1):
    D.add_page_break()
    p=D.add_paragraph(); p.paragraph_format.space_after=Pt(2)
    r=p.add_run(f'Test Case {idx:02d}  |  {component}'); format_run(r,16,True,NAVY)
    p=D.add_paragraph(); p.paragraph_format.space_after=Pt(7)
    r=p.add_run(objective); format_run(r,9.5,False,MUTED)
    T=D.add_table(rows=0,cols=2); T.alignment=WD_TABLE_ALIGNMENT.CENTER; T.autofit=False; T.columns[0].width=Inches(2.05); T.columns[1].width=Inches(8.55); borders(T)
    add_labeled_row(T,'Module Name',module)
    add_labeled_row(T,'Component Name',component,'EAF2F4','FFFFFF')
    add_labeled_row(T,'Test Cycle No.','Cycle 5 (or current cycle)')
    add_labeled_row(T,'Date Tested','[Date]')
    add_labeled_row(T,'Type of System','Web Application (Desktop Browser)')
    add_labeled_row(T,'Pre-conditions & Action Description',actions)
    add_labeled_row(T,'Verification Steps & Scenario Inputs',verify)
    add_labeled_row(T,'Expected Results',expected)
    cells=T.add_row().cells; cells[0].width=Inches(2.05); cells[1].width=Inches(8.55)
    shade(cells[0],PALE); add_text(cells[0],'Actual Results (Screenshot placeholder box)',True,NAVY,8.3)
    shade(cells[1],'FFFFFF'); cells[1].text=''; p=cells[1].paragraphs[0]; p.alignment=WD_ALIGN_PARAGRAPH.CENTER; p.paragraph_format.space_after=Pt(0)
    r=p.add_run('[ Paste or insert web interface screenshot here ]'); format_run(r,9,False,MUTED)
    ppr=p._p.get_or_add_pPr(); borders_xml=OxmlElement('w:pBdr'); bottom=OxmlElement('w:bottom'); bottom.set(qn('w:val'),'dashed'); bottom.set(qn('w:sz'),'8'); bottom.set(qn('w:space'),'3'); bottom.set(qn('w:color'),BORDER); borders_xml.append(bottom); ppr.append(borders_xml)
    set_cell_margins(cells[1],top=360,start=100,bottom=360,end=100); cells[1].vertical_alignment=WD_CELL_VERTICAL_ALIGNMENT.CENTER
    cells=T.add_row().cells; cells[0].width=Inches(2.05); cells[1].width=Inches(8.55); shade(cells[0],PALE); add_text(cells[0],'Remarks (PASSED / FAILED)',True,NAVY,8.3); shade(cells[1],'FFFFFF'); add_text(cells[1],'☐ PASSED     ☐ FAILED     Notes: ______________________________________________',False,TEXT,9)

# Make all tables have consistent compact row text and prevent row splitting.
for table in D.tables:
    for row in table.rows:
        trPr=row._tr.get_or_add_trPr(); cant=OxmlElement('w:cantSplit'); trPr.append(cant)

D.core_properties.title='AgriX Web Application Unit Testing Instructions & Authorization Notice'
D.core_properties.subject='Cycle 5 unit test plan for the AgriX Admin and Client Web Portals'
D.core_properties.author='AgriX'
D.save(OUT)
print(OUT)
