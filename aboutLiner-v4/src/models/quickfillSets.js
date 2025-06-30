// Quickfill data sets for aboutLiner
// Edit this file to add/modify sets, aliases, and valid column headers

const quickfillSets = [
  {
    name: 'Severity',
    set: ['Critical', 'High', 'Medium', 'Low'],
    aliases: { 'Urgent': 'Critical', 'Blocker': 'Critical', 'Major': 'High', 'Minor': 'Low' },
    aliasesForColumn: ['Urgent', 'Blocker', 'Major', 'Minor']
  },
  {
    name: 'Priority',
    set: ['High', 'Medium', 'Low'],
    aliases: { 'Urgent': 'High', 'Critical': 'High', 'Blocker': 'High', 'Normal': 'Medium', 'Minor': 'Low' },
    aliasesForColumn: ['Urgent', 'Critical', 'Blocker', 'Normal', 'Minor']
  },
  {
    name: 'Status',
    set: ['To Do', 'In Progress', 'Done'],
    aliases: { 'Open': 'To Do', 'Complete': 'Done', 'Completed': 'Done', 'Started': 'In Progress', 'Closed': 'Done', 'Finished': 'Done' },
    aliasesForColumn: ['Open', 'Complete', 'Completed', 'Started', 'Closed', 'Finished']
  },
  {
    name: 'Resolution',
    set: ['Open', 'Pending', 'Resolved', 'Closed'],
    aliases: { 'In Progress': 'Pending', 'Done': 'Resolved', 'Complete': 'Resolved', 'Completed': 'Resolved' },
    aliasesForColumn: ['In Progress', 'Done', 'Complete', 'Completed']
  },
  {
    name: 'Yes/No',
    set: ['Yes', 'No'],
    aliases: { 'True': 'Yes', 'False': 'No', 'Y': 'Yes', 'N': 'No' },
    aliasesForColumn: ['True', 'False', 'Y', 'N']
  },
  {
    name: 'Enabled/Disabled',
    set: ['Enabled', 'Disabled'],
    aliases: { 'On': 'Enabled', 'Off': 'Disabled', 'Active': 'Enabled', 'Inactive': 'Disabled' },
    aliasesForColumn: ['On', 'Off', 'Active', 'Inactive']
  },
  {
    name: 'Size',
    set: ['XS', 'S', 'M', 'L', 'XL'],
    aliases: { 'Extra Small': 'XS', 'Small': 'S', 'Medium': 'M', 'Large': 'L', 'Extra Large': 'XL' },
    aliasesForColumn: ['Extra Small', 'Small', 'Medium', 'Large', 'Extra Large']
  }
];

export default quickfillSets;
