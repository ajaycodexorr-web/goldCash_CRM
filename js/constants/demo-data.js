/**
 * Demo Leads Fallback Seed Data
 */

export const DEMO_LEADS = [
  {
    id: "919876543210",
    name: "Maya Lin",
    company: "Glow Studios",
    handle: "maya.lin.design",
    phone: "+91 98765 43210",
    status: "new",
    firstMessage: "Hello! Does your platform provide automatic webhook syncing with our database?",
    lastMessage: "Hello! Does your platform provide automatic webhook syncing with our database?",
    lastMessageAt: new Date(Date.now() - 10 * 60 * 1000),
    unreadCount: 2,
    messages: [
      {
        id: "wamid_demo_101",
        text: "Hello! Does your platform provide automatic webhook syncing with our database?",
        direction: "incoming",
        status: "read",
        timestamp: String(Math.floor((Date.now() - 10 * 60 * 1000) / 1000)),
        createdAt: new Date(Date.now() - 10 * 60 * 1000)
      }
    ]
  },
  {
    id: "919123456789",
    name: "Rahul Sharma",
    company: "Apex Properties",
    handle: "rahul.sharma",
    phone: "+91 91234 56789",
    status: "new",
    firstMessage: "Could you please share photographs of the ready-to-move 3BHK luxury villas?",
    lastMessage: "Could you please share photographs of the ready-to-move 3BHK luxury villas?",
    lastMessageAt: new Date(Date.now() - 2 * 3600 * 1000),
    unreadCount: 1,
    messages: [
      {
        id: "wamid_demo_201",
        text: "Could you please share photographs of the ready-to-move 3BHK luxury villas?",
        direction: "incoming",
        status: "read",
        timestamp: String(Math.floor((Date.now() - 2 * 3600 * 1000) / 1000)),
        createdAt: new Date(Date.now() - 2 * 3600 * 1000)
      }
    ]
  },
  {
    id: "919811223344",
    name: "Taksh Sheth",
    company: "Commerce Hub",
    handle: "taksh.sheth",
    phone: "+91 98112 23344",
    status: "contacted",
    firstMessage: "Hi, what services and plans do you offer for commercial batch orders?",
    lastMessage: "Hi, what services and plans do you offer for commercial batch orders?",
    lastMessageAt: new Date(Date.now() - 6 * 86400 * 1000),
    unreadCount: 0,
    messages: [
      {
        id: "wamid_demo_301",
        text: "Hi, what services and plans do you offer for commercial batch orders?",
        direction: "incoming",
        status: "read",
        timestamp: String(Math.floor((Date.now() - 6 * 86400 * 1000) / 1000)),
        createdAt: new Date(Date.now() - 6 * 86400 * 1000)
      }
    ]
  }
];
