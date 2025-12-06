/**
 * Mock data for development and testing
 * Replace with API calls in production
 */

import type {
  Politician,
  Topic,
  NetworkEdge,
  Prefecture,
  Comment,
} from "@/app/types";

export const mockTopics: Topic[] = [
  {
    id: "defense",
    label: "Defense & security",
    keyword: "defense",
    subtopics: [
      {
        id: "defense_budget",
        label: "Defense budget",
        keyword: "budget",
      },
      {
        id: "alliances",
        label: "Alliances & treaties",
        keyword: "alliance",
      },
    ],
  },
  {
    id: "welfare",
    label: "Welfare & social policy",
    keyword: "welfare",
    subtopics: [
      {
        id: "social_welfare",
        label: "Social welfare reform",
        keyword: "welfare",
      },
      {
        id: "families",
        label: "Support for families",
        keyword: "families",
      },
    ],
  },
  {
    id: "climate",
    label: "Climate & energy",
    keyword: "climate",
    subtopics: [
      {
        id: "energy_transition",
        label: "Energy transition",
        keyword: "energy",
      },
      {
        id: "renewables",
        label: "Renewables & green jobs",
        keyword: "renewables",
      },
    ],
  },
  {
    id: "digital_gov",
    label: "Digital government & data",
    keyword: "digital",
    subtopics: [
      {
        id: "digital_services",
        label: "Digital services",
        keyword: "digital",
      },
      {
        id: "privacy",
        label: "Data & privacy",
        keyword: "privacy",
      },
    ],
  },
  {
    id: "transparency",
    label: "Transparency & process",
    keyword: "transparency",
    subtopics: [
      {
        id: "committee_transparency",
        label: "Committee transparency",
        keyword: "committee",
      },
      {
        id: "livestreaming",
        label: "Livestreaming & openness",
        keyword: "livestream",
      },
    ],
  },
];

export const mockPrefectures: Prefecture[] = [
  {
    id: "hokkaido",
    name: "Hokkaido",
    path: "M110 25 L150 25 L165 40 L150 55 L110 55 L100 40 Z",
    labelX: 130,
    labelY: 40,
  },
  {
    id: "tokyo",
    name: "Tokyo",
    path: "M150 130 L170 130 L175 145 L165 155 L148 150 Z",
    labelX: 162,
    labelY: 145,
  },
  {
    id: "kanagawa",
    name: "Kanagawa",
    path: "M152 156 L175 155 L180 170 L165 180 L150 170 Z",
    labelX: 170,
    labelY: 170,
  },
  {
    id: "kyoto",
    name: "Kyoto",
    path: "M120 160 L140 160 L145 175 L130 185 L115 175 Z",
    labelX: 132,
    labelY: 175,
  },
  {
    id: "osaka",
    name: "Osaka",
    path: "M115 182 L140 185 L142 200 L125 210 L110 198 Z",
    labelX: 128,
    labelY: 198,
  },
];

export const mockPoliticians: Politician[] = [
  {
    id: "p1",
    name: "Akiko Tanaka",
    party: "Reform Party",
    isMajor: true,
    ideology: { econ: -0.7, social: 0.3 },
    topicScores: { defense: -0.2, welfare: 0.8 },
    trustScore: 82,
    trustLabel: "High consistency",
    factScore: 88,
    factLabel: "High factual accuracy",
    district: {
      prefectureId: "tokyo",
      prefectureName: "Tokyo",
      name: "Tokyo 3rd district",
    },
    photoUrl:
      "https://images.pexels.com/photos/1181686/pexels-photo-1181686.jpeg?auto=compress&cs=tinysrgb&w=200",
    summary:
      "Centre-left reformist focused on social safety nets, climate transition, and transparent decision-making.",
    keyPositions: [
      {
        topic: "Social welfare",
        stance: "Expand benefits for young families and single parents.",
      },
      {
        topic: "Climate",
        stance: "Accelerate renewables and green industrial policy.",
      },
      {
        topic: "Transparency",
        stance: "Publish plain-language explanations for major bills.",
      },
    ],
    career: [
      {
        period: "2022 – present",
        role: "Member of Parliament",
        note: "Reform Party, Tokyo 3rd district.",
      },
      {
        period: "2016 – 2022",
        role: "Policy Analyst",
        note: "Think tank on social welfare reform.",
      },
    ],
    speeches: [
      {
        id: "s1",
        date: "2025-03-15",
        topic: "Social welfare reform",
        excerpt:
          "We must redesign the welfare system so that young families and single parents are no longer choosing between rent and food...",
        factStatus: "accurate",
        factNote:
          "Core statistics in this speech match independent estimates from the statistics bureau.",
      },
      {
        id: "s2",
        date: "2025-04-02",
        topic: "Climate policy",
        excerpt:
          "Our climate transition plan must prioritize green jobs, especially in regions most dependent on legacy industries...",
        factStatus: "misleading",
        factNote:
          "Job creation projections rely on optimistic assumptions compared to central bank scenarios.",
      },
    ],
    tweets: [
      {
        id: "t1",
        date: "2025-03-16",
        topic: "Welfare thread",
        content:
          "Yesterday's speech was about one thing: dignity. No parent should have to choose between rent and dinner. Policy thread below ⬇️",
        url: "https://twitter.com/example/status/1111111111",
        factStatus: "accurate",
        factNote: "Normative statement, no concrete factual claims flagged.",
      },
      {
        id: "t2",
        date: "2025-04-03",
        topic: "Climate Q&A",
        content:
          "Some asked if climate jobs mean losing manufacturing. The answer is no: we invest in retraining *and* local industries.",
        url: "https://twitter.com/example/status/1111111112",
        factStatus: "misleading",
        factNote:
          "Evidence suggests some sectors still face medium-term employment risks.",
      },
    ],
  },
  {
    id: "p2",
    name: "Hiroshi Sato",
    party: "Conservative Alliance",
    isMajor: true,
    ideology: { econ: 0.6, social: 0.7 },
    topicScores: { defense: 0.9, welfare: -0.4 },
    trustScore: 61,
    trustLabel: "Mixed consistency",
    factScore: 72,
    factLabel: "Mostly accurate with some disputes",
    district: {
      prefectureId: "kanagawa",
      prefectureName: "Kanagawa",
      name: "Kanagawa 1st district",
    },
    photoUrl:
      "https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=200",
    summary:
      "Security-focused conservative emphasising defense spending and fiscal restraint, sceptical of large welfare expansions.",
    keyPositions: [
      {
        topic: "Defense",
        stance: "Incremental but steady increases in defense spending.",
      },
      {
        topic: "Fiscal policy",
        stance: "Avoid unfunded programmes; prioritise debt stability.",
      },
      {
        topic: "Alliances",
        stance: "Deepen regional security partnerships.",
      },
    ],
    career: [
      {
        period: "2018 – present",
        role: "Member of Parliament",
        note: "Conservative Alliance, Kanagawa 1st.",
      },
      {
        period: "2012 – 2018",
        role: "MoF official",
        note: "Budget bureau, fiscal consolidation team.",
      },
    ],
    speeches: [
      {
        id: "s3",
        date: "2025-02-10",
        topic: "Defense spending",
        excerpt:
          "In a region where our neighbours rapidly expand their capabilities, predictable and steady defense investment is not optional...",
        factStatus: "accurate",
        factNote: "Defense spending figures align with publicly available budgets.",
      },
      {
        id: "s4",
        date: "2025-03-01",
        topic: "Fiscal responsibility and the defense budget",
        excerpt:
          "We cannot pass unfunded promises to the next generation. Every programme must be paired with a credible funding plan...",
        factStatus: "accurate",
        factNote: "Debt projections cited are broadly consistent with central bank reports.",
      },
    ],
    tweets: [
      {
        id: "t3",
        date: "2025-02-11",
        topic: "Defense clarification",
        content:
          'Defense isn\'t about "militarism". It\'s about ensuring our kids never have to experience war. Thread on why stability matters:',
        url: "https://twitter.com/example/status/2222222221",
        factStatus: "accurate",
        factNote: "Mostly normative; no specific factual claims flagged.",
      },
      {
        id: "t4",
        date: "2025-03-02",
        topic: "Budget stance",
        content:
          "If we add new spending without funding, we are quietly taxing our children. Tough choices now mean fewer shocks later.",
        url: "https://twitter.com/example/status/2222222222",
        factStatus: "accurate",
        factNote: "Standard economic framing; no explicit numeric claim contradicted.",
      },
    ],
  },
  {
    id: "p3",
    name: "Naomi Suzuki",
    party: "Green Future",
    isMajor: false,
    ideology: { econ: -0.4, social: -0.6 },
    topicScores: { defense: -0.7, welfare: 0.6 },
    trustScore: 89,
    trustLabel: "Very high consistency",
    factScore: 93,
    factLabel: "Very high factual accuracy",
    district: {
      prefectureId: "kyoto",
      prefectureName: "Kyoto",
      name: "Kyoto at-large",
    },
    photoUrl:
      "https://images.pexels.com/photos/733872/pexels-photo-733872.jpeg?auto=compress&cs=tinysrgb&w=200",
    summary:
      "Left-leaning environmentalist with a strong anti-militarist stance and emphasis on decentralised, participatory democracy.",
    keyPositions: [
      {
        topic: "Energy",
        stance: "Phase-out fossils; ban new coal; community-owned renewables.",
      },
      {
        topic: "Defense",
        stance: "Reduce offensive capabilities; prioritise diplomacy and disaster relief forces.",
      },
      {
        topic: "Democracy",
        stance: "Participatory budgeting and citizen assemblies on climate.",
      },
    ],
    career: [
      {
        period: "2023 – present",
        role: "Member of Parliament",
        note: "Green Future, Kyoto at-large.",
      },
      {
        period: "2015 – 2023",
        role: "NGO director",
        note: "Grassroots climate justice organisation.",
      },
    ],
    speeches: [
      {
        id: "s5",
        date: "2025-01-21",
        topic: "Energy transition",
        excerpt:
          "We have a once-in-a-generation opportunity to leapfrog into a distributed, renewables-first grid that leaves no region behind...",
        factStatus: "accurate",
        factNote: "Renewable capacity and timeline claims are in line with energy agency data.",
      },
    ],
    tweets: [
      {
        id: "t5",
        date: "2025-01-22",
        topic: "Grid democracy",
        content:
          "Energy should be a commons, not just a commodity. Municipal and community-owned grids can keep profits local.",
        url: "https://twitter.com/example/status/3333333333",
        factStatus: "accurate",
        factNote: "Normative statement; no disputed statistics identified.",
      },
    ],
  },
  {
    id: "p4",
    name: "Daichi Kobayashi",
    party: "Liberal Democratic Front",
    isMajor: true,
    ideology: { econ: 0.2, social: -0.3 },
    topicScores: { defense: 0.3, welfare: 0.4 },
    trustScore: 74,
    trustLabel: "Stable messaging",
    factScore: 79,
    factLabel: "Generally accurate",
    district: {
      prefectureId: "osaka",
      prefectureName: "Osaka",
      name: "Osaka 6th district",
    },
    photoUrl:
      "https://images.pexels.com/photos/1181519/pexels-photo-1181519.jpeg?auto=compress&cs=tinysrgb&w=200",
    summary:
      "Tech-forward liberal with focus on digital government, skills, and pragmatic incremental reforms.",
    keyPositions: [
      {
        topic: "Digital gov",
        stance: "End all paper-only procedures; 5-minute online interactions as a standard.",
      },
      {
        topic: "Education",
        stance: "Digital literacy and critical thinking as core subjects.",
      },
      {
        topic: "Data",
        stance: "Stronger privacy protections with pro-innovation sandboxes.",
      },
    ],
    career: [
      {
        period: "2020 – present",
        role: "Member of Parliament",
        note: "LDF, Osaka 6th district.",
      },
      {
        period: "2013 – 2020",
        role: "Product lead",
        note: "GovTech startup building online identity solutions.",
      },
    ],
    speeches: [
      {
        id: "s6",
        date: "2025-02-05",
        topic: "Digital government",
        excerpt:
          "Citizens should be able to complete any interaction with the state online, securely, and in under five minutes...",
        factStatus: "accurate",
        factNote:
          "Benchmark examples from other countries roughly match the targets cited.",
      },
      {
        id: "s7",
        date: "2025-03-11",
        topic: "Education",
        excerpt:
          "If we want a globally competitive workforce, then digital literacy and critical thinking must become core, not elective...",
        factStatus: "accurate",
        factNote: "Education ranking references broadly align with OECD data.",
      },
    ],
    tweets: [
      {
        id: "t6",
        date: "2025-02-06",
        topic: "Gov UX rant",
        content:
          "If your form still requires fax, it's not \"tradition\"—it's a bug. Citizens deserve better UX from their own state.",
        url: "https://twitter.com/example/status/4444444444",
        factStatus: "accurate",
        factNote: "Anecdotal but no specific factual errors flagged.",
      },
    ],
  },
  {
    id: "p5",
    name: "Yuki Nakamura",
    party: "Independents",
    isMajor: false,
    ideology: { econ: 0.0, social: 0.0 },
    topicScores: { defense: 0.1, welfare: 0.1 },
    trustScore: 55,
    trustLabel: "Low data / early term",
    factScore: 60,
    factLabel: "Limited fact-checking data",
    district: {
      prefectureId: "hokkaido",
      prefectureName: "Hokkaido",
      name: "Sapporo region",
    },
    photoUrl:
      "https://images.pexels.com/photos/2379005/pexels-photo-2379005.jpeg?auto=compress&cs=tinysrgb&w=200",
    summary:
      "First-term independent emphasising procedural transparency and constituency service over ideological branding.",
    keyPositions: [
      {
        topic: "Transparency",
        stance: "Stream live all committee meetings; publish voting rationales.",
      },
      {
        topic: "Local issues",
        stance: "Treat citizen petitions as first-class agenda items.",
      },
    ],
    career: [
      {
        period: "2024 – present",
        role: "Member of Parliament",
        note: "Independent, Sapporo region.",
      },
      {
        period: "2018 – 2024",
        role: "Local councillor",
        note: "Known for livestreamed council sessions.",
      },
    ],
    speeches: [
      {
        id: "s8",
        date: "2025-01-05",
        topic: "Procedural transparency",
        excerpt:
          "Transparency in committee, not just in plenary, is where we can rebuild trust in how decisions are actually made...",
        factStatus: "accurate",
        factNote: "Descriptive; no contested statistics.",
      },
    ],
    tweets: [
      {
        id: "t7",
        date: "2025-01-06",
        topic: "Livestreaming committees",
        content:
          "Next week I'll try an experiment: live-commenting on committee from my own account so you can see what I see, in real time.",
        url: "https://twitter.com/example/status/5555555555",
        factStatus: "false",
        factNote: "Experiment did not take place on the date mentioned; session was postponed.",
      },
    ],
  },
];

export const mockEdges: NetworkEdge[] = [
  { source: "p1", target: "p2", weight: 3 },
  { source: "p2", target: "p1", weight: 1 },
  { source: "p1", target: "p4", weight: 2 },
  { source: "p3", target: "p4", weight: 4 },
  { source: "p4", target: "p2", weight: 2 },
  { source: "p5", target: "p1", weight: 1 },
];

export const mockComments: Comment[] = [
  {
    id: "c1",
    politicianId: "p1",
    targetType: "speech",
    targetId: "s1",
    userName: "Aya",
    handle: "@aya_policynerd",
    text: "This is the first time I felt a welfare speech connect with single parents' reality.",
    createdAt: "2025-03-16 09:12",
  },
  {
    id: "c2",
    politicianId: "p1",
    targetType: "tweet",
    targetId: "t1",
    userName: "Kenji",
    handle: "@kenji_tokyo",
    text: "Thread is super clear, but I'd like to see concrete funding sources.",
    createdAt: "2025-03-16 10:30",
  },
  {
    id: "c3",
    politicianId: "p2",
    targetType: "speech",
    targetId: "s3",
    userName: "Mika",
    handle: "@mika_peace",
    text: "I'm worried this pushes us further into an arms race. Where is the diplomacy part?",
    createdAt: "2025-02-11 14:01",
  },
  {
    id: "c4",
    politicianId: "p3",
    targetType: "tweet",
    targetId: "t5",
    userName: "Ryo",
    handle: "@ryo_energy",
    text: "Municipal grids are cool, but any examples from abroad we can copy?",
    createdAt: "2025-01-23 18:45",
  },
];

