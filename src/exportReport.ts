// Export report as PDF or DOCX
import { S1Case } from './types';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as docx from 'docx';
import { saveAs } from 'file-saver';
export function exportReportPDF(report: any, s1Cases: S1Case[]) {
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text('S1 Projects Report', 10, 10);
  doc.setFontSize(10);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 10, 18);

  // Summary
  doc.text('Summary', 10, 28);
  let y = 34;
  for (const [k, v] of Object.entries(report.summary)) {
    doc.text(`${k}: ${v}`, 10, y);
    y += 6;
  }

  // Projects Table
  doc.text('Projects', 10, y + 4);
  y += 10;
  autoTable(doc, {
    startY: y,
    head: [['Project', 'Tasks', 'Done', 'Created']],
    body: report.projects.map((p: any) => [p.name, String(p.total_tasks), String(p.completed_tasks), new Date(p.created_at).toLocaleDateString()]),
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // Tasks
  doc.text('Tasks', 10, y);
  y += 6;
  autoTable(doc, {
    startY: y,
    head: [['Title', 'Status', 'Assignee']],
    body: report.recentTasks.map((t: any) => [t.title, t.status, t.assignee || 'Unassigned']),
  });
  y = (doc as any).lastAutoTable.finalY + 10;

  // S1 Analytics Cases
  doc.text('S1 Analytics Cases', 10, y);
  y += 6;
  autoTable(doc, {
    startY: y,
    head: [['Case ID', 'Subject', 'Group', 'Assigned To', 'Classification', 'Channel', 'Date']],
    body: s1Cases.map((c: S1Case) => [c.case_id, c.subject || '', c.group_name || '', c.assigned_to || '', c.classification || '', c.channel || '', c.dt || '']),
  });

  doc.save(`S1_Projects_Report_${new Date().toISOString().slice(0,10)}.pdf`);
}

export async function exportReportDOCX(report: any, s1Cases: S1Case[]) {
  const doc = new docx.Document({
    sections: [
      {
        children: [
          new docx.Paragraph({ text: 'S1 Projects Report', heading: docx.HeadingLevel.HEADING_1 }),
          new docx.Paragraph({ text: `Generated: ${new Date().toLocaleString()}` }),
          new docx.Paragraph({ text: 'Summary', heading: docx.HeadingLevel.HEADING_2 }),
          ...Object.entries(report.summary).map(([k, v]) => new docx.Paragraph(`${k}: ${v}`)),
          new docx.Paragraph({ text: 'Projects', heading: docx.HeadingLevel.HEADING_2 }),
          new docx.Table({
            rows: [
              new docx.TableRow({
                children: [
                  new docx.TableCell({ children: [new docx.Paragraph('Project')] }),
                  new docx.TableCell({ children: [new docx.Paragraph('Tasks')] }),
                  new docx.TableCell({ children: [new docx.Paragraph('Done')] }),
                  new docx.TableCell({ children: [new docx.Paragraph('Created')] }),
                ]
              }),
              ...report.projects.map((p: any) => new docx.TableRow({
                children: [
                  new docx.TableCell({ children: [new docx.Paragraph(p.name)] }),
                  new docx.TableCell({ children: [new docx.Paragraph(String(p.total_tasks))] }),
                  new docx.TableCell({ children: [new docx.Paragraph(String(p.completed_tasks))] }),
                  new docx.TableCell({ children: [new docx.Paragraph(new Date(p.created_at).toLocaleDateString())] }),
                ]
              }))
            ]
          }),
          new docx.Paragraph({ text: 'Tasks', heading: docx.HeadingLevel.HEADING_2 }),
          new docx.Table({
            rows: [
              new docx.TableRow({
                children: [
                  new docx.TableCell({ children: [new docx.Paragraph('Title')] }),
                  new docx.TableCell({ children: [new docx.Paragraph('Status')] }),
                  new docx.TableCell({ children: [new docx.Paragraph('Assignee')] }),
                ]
              }),
              ...report.recentTasks.map((t: any) => new docx.TableRow({
                children: [
                  new docx.TableCell({ children: [new docx.Paragraph(t.title)] }),
                  new docx.TableCell({ children: [new docx.Paragraph(t.status)] }),
                  new docx.TableCell({ children: [new docx.Paragraph(t.assignee || 'Unassigned')] }),
                ]
              }))
            ]
          }),
          new docx.Paragraph({ text: 'S1 Analytics Cases', heading: docx.HeadingLevel.HEADING_2 }),
          new docx.Table({
            rows: [
              new docx.TableRow({
                children: [
                  new docx.TableCell({ children: [new docx.Paragraph('Case ID')] }),
                  new docx.TableCell({ children: [new docx.Paragraph('Subject')] }),
                  new docx.TableCell({ children: [new docx.Paragraph('Group')] }),
                  new docx.TableCell({ children: [new docx.Paragraph('Assigned To')] }),
                  new docx.TableCell({ children: [new docx.Paragraph('Classification')] }),
                  new docx.TableCell({ children: [new docx.Paragraph('Channel')] }),
                  new docx.TableCell({ children: [new docx.Paragraph('Date')] }),
                ]
              }),
              ...s1Cases.map((c: S1Case) => new docx.TableRow({
                children: [
                  new docx.TableCell({ children: [new docx.Paragraph(c.case_id)] }),
                  new docx.TableCell({ children: [new docx.Paragraph(c.subject || '')] }),
                  new docx.TableCell({ children: [new docx.Paragraph(c.group_name || '')] }),
                  new docx.TableCell({ children: [new docx.Paragraph(c.assigned_to || '')] }),
                  new docx.TableCell({ children: [new docx.Paragraph(c.classification || '')] }),
                  new docx.TableCell({ children: [new docx.Paragraph(c.channel || '')] }),
                  new docx.TableCell({ children: [new docx.Paragraph(c.dt || '')] }),
                ]
              }))
            ]
          })
        ]
      }
    ]
  });
  const blob = await docx.Packer.toBlob(doc);
  saveAs(blob, `S1_Projects_Report_${new Date().toISOString().slice(0,10)}.docx`);
}
