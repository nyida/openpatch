export type ResearchBlock =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'ul'; items: string[] }
  | { type: 'pullQuote'; text: string; attribution?: string }
  | { type: 'stat'; value: string; label: string; source?: string }
  | {
      type: 'statRow';
      stats: { value: string; label: string }[];
      source?: string;
    };

export type ResearchPiece = {
  slug: string;
  title: string;
  summary: string;
  published: string;
  category: 'Research';
  body: ResearchBlock[];
  references: string[];
};

/**
 * Long-form research notes - Relemetry article structure:
 * eyebrow/date/h1, prose, h2s, pull-quotes, stat callouts, numbered References.
 * Sources are public academic / institutional literature. No invented prevalence stats.
 */
export const RESEARCH: ResearchPiece[] = [
  {
    slug: 'informed-flow-prediction-markets',
    title: 'Informed flow in prediction markets: what whales actually tell you',
    summary:
      'Prediction markets aggregate dispersed information - but large trades are not automatically “smart money.” A framework for reading whale flow with the literature, not folklore.',
    published: 'July 2026',
    category: 'Research',
    body: [
      {
        type: 'p',
        text: 'Prediction markets are often described as machines for discovering the probability of future events. That reputation rests on a simple idea: people with information and capital will bid prices toward accuracy, and the resulting quote is a usable forecast. Decades of work support the core claim that markets can aggregate dispersed knowledge more effectively than polls alone (Wolfers & Zitzewitz, 2004; Arrow et al., 2008). But the leap from “markets can be informative” to “this large fill is informed” is where most desks get sloppy.',
      },
      {
        type: 'p',
        text: 'On venues like Polymarket and Kalshi, a whale print can mean conviction - or inventory, hedging, attention chasing, or a market-maker rebalancing. Algomarket’s whale layer exists to make that ambiguity inspectable: size, persistence, venue, and whether multiple accounts lean the same way. This note lays out how we reason about that layer, grounded in public research rather than trader Twitter.',
      },
      {
        type: 'pullQuote',
        text: '“Prediction markets are the best technology we have for extracting information from people who have it and putting it into a form that is useful for decision-makers.”',
        attribution: 'Arrow et al., Science (2008)',
      },
      {
        type: 'h2',
        text: 'What the literature actually says',
      },
      {
        type: 'p',
        text: 'Classic surveys argue that prediction markets excel when traders are heterogeneous, incentives are real, and contracts are well-defined (Wolfers & Zitzewitz, 2004). The Iowa Electronic Markets literature, among others, showed that market prices can track election outcomes competitively with polls under many conditions (Berg, Nelson, & Rietz, 2008). Separately, work on interpreting prices warns against reading a quoted probability as a pure belief: risk preferences, liquidity, and wealth effects distort the mapping from beliefs to prices (Manski, 2006).',
      },
      {
        type: 'p',
        text: 'Market-microstructure theory adds another constraint. Informed trading models (Kyle, 1985) imply that large orders move prices precisely because they may contain information - but they also attract camouflage. Noise traders, hedgers, and market makers coexist with informed agents. Observing a large trade without context is therefore not a signal; it is a hypothesis generator.',
      },
      {
        type: 'stat',
        value: 'Not a signal',
        label:
          'A single large fill is a hypothesis, not a forecast. Pair size with persistence, co-movement, and contract clarity before treating flow as informed.',
        source: 'Synthesis of Kyle (1985); Manski (2006); Wolfers & Zitzewitz (2004)',
      },
      {
        type: 'h2',
        text: 'A practical reading stack for whale prints',
      },
      {
        type: 'p',
        text: 'Algomarket does not claim to identify “correct” whales. We organize the desk so you can ask better questions faster:',
      },
      {
        type: 'ul',
        items: [
          'Notional before narrative - rank exposure by dollars at risk, not by how loud a market is on social feeds.',
          'Persistence over prints - prefer accounts and books that reappear across sessions to one-off spikes.',
          'Cross-venue identity - the same event on Polymarket and Kalshi can host different participant sets; align contracts before comparing flow.',
          'Resolution clarity - poorly specified contracts weaken the information-aggregation story the literature celebrates (Arrow et al., 2008).',
        ],
      },
      {
        type: 'h2',
        text: 'Limits we state plainly',
      },
      {
        type: 'p',
        text: 'We do not publish win rates for whales. We do not invent how often large traders are right. Prediction markets remain uncertain environments; the product thesis is situational awareness - a clearer map of who is pressing which books - not automated alpha. That humility is deliberate: the same papers that praise markets also document bias, thin liquidity, and misinterpretation of prices as probabilities (Manski, 2006).',
      },
      {
        type: 'p',
        text: 'For Algomarket, the research implication is operational. Free users get the whale dashboard and trader views to study structure. Pro tools (live flow, exposure rankings) tighten the loop when you need higher-frequency context. In both cases, the literature’s warning stands: treat flow as evidence to weigh, not as an oracle.',
      },
    ],
    references: [
      'Arrow, K. J., et al. (2008). “The Promise of Prediction Markets.” Science, 320(5878), 877–878.',
      'Berg, J., Nelson, F., & Rietz, T. (2008). “Prediction Market Accuracy in the Long Run.” International Journal of Forecasting, 24(2), 285–300.',
      'Kyle, A. S. (1985). “Continuous Auctions and Insider Trading.” Econometrica, 53(6), 1315–1335.',
      'Manski, C. F. (2006). “Interpreting the Predictions of Prediction Markets.” Economics Letters, 91(3), 425–429.',
      'Wolfers, J., & Zitzewitz, E. (2004). “Prediction Markets.” Journal of Economic Perspectives, 18(2), 107–126.',
      'Wolfers, J., & Zitzewitz, E. (2006). “Interpreting Prediction Market Prices as Probabilities.” NBER Working Paper No. 12200.',
    ],
  },
  {
    slug: 'cross-venue-price-discovery',
    title: 'Cross-venue price discovery: Polymarket, Kalshi, and the law of one price',
    summary:
      'When the same event trades in two places, prices can diverge. Why that happens, what the literature implies, and how Algomarket’s arb layer should be read.',
    published: 'July 2026',
    category: 'Research',
    body: [
      {
        type: 'p',
        text: 'Fragmented venues are not new. Equity and futures markets have long confronted the “law of one price”: economically identical claims should trade at similar prices after costs, or arbitrageurs compress the gap. Prediction markets now face a version of that problem as related event contracts appear on multiple platforms - notably crypto-native books like Polymarket and regulated U.S. venues such as Kalshi.',
      },
      {
        type: 'p',
        text: 'Algomarket’s arbitrage scanner (Pro) surfaces those gaps after normalizing contract identity. This note explains why raw spreads are not free money, and how price-discovery research should frame what you are looking at.',
      },
      {
        type: 'h2',
        text: 'Identical events are rarer than they look',
      },
      {
        type: 'p',
        text: 'Before microstructure matters, contract design matters. Two markets can share a headline question and still differ in resolution source, cutoff time, early close rules, or payout currency. Prediction-market scholarship repeatedly stresses that informational efficiency depends on well-specified claims (Wolfers & Zitzewitz, 2004; Arrow et al., 2008). A scanner that links venues without checking definitions will invent “arbs” that are really basis risk.',
      },
      {
        type: 'pullQuote',
        text: 'A quoted cross-venue spread is a research prompt: Are the contracts equivalent? Is one book thinner? Has news hit one venue first?',
        attribution: 'Algomarket methodology',
      },
      {
        type: 'h2',
        text: 'What can keep prices apart',
      },
      {
        type: 'ul',
        items: [
          'Fees and spreads - retail fee schedules and bid–ask width can exceed a seemingly large mid-to-mid gap.',
          'Latency and attention - news can hit one venue’s order book before the other; flicker is not a locked trade.',
          'Capital and access - different participant pools (crypto wallets vs. KYC’d exchange accounts) change who can close the gap.',
          'Inventory and hedging - market makers may quote asymmetrically without expressing a directional view.',
        ],
      },
      {
        type: 'statRow',
        stats: [
          { value: 'Identity', label: 'Match event definitions first' },
          { value: 'Costs', label: 'Fees + spread eat the gap' },
          { value: 'Stability', label: 'Prefer persistent mispricings' },
        ],
        source: 'Operational checklist derived from law-of-one-price reasoning; not empirical win rates',
      },
      {
        type: 'h2',
        text: 'How Algomarket uses the research',
      },
      {
        type: 'p',
        text: 'We treat cross-venue discrepancies as comparative research objects: show both prices, link both venues, and leave execution judgment to the user. That stance mirrors academic caution about reading market prices as clean probabilities (Manski, 2006; Wolfers & Zitzewitz, 2006). The Pro scanner is a desk tool for discovery, not a guarantee of risk-free return after costs.',
      },
      {
        type: 'p',
        text: 'Free users still benefit from the conceptual frame via the dashboard and screener: understand which books are liquid and how odds sit before chasing venue gaps. Pro unlocks the continuous comparison layer when you are actively hunting fragmentation.',
      },
    ],
    references: [
      'Arrow, K. J., et al. (2008). “The Promise of Prediction Markets.” Science, 320(5878), 877–878.',
      'Manski, C. F. (2006). “Interpreting the Predictions of Prediction Markets.” Economics Letters, 91(3), 425–429.',
      'Wolfers, J., & Zitzewitz, E. (2004). “Prediction Markets.” Journal of Economic Perspectives, 18(2), 107–126.',
      'Wolfers, J., & Zitzewitz, E. (2006). “Interpreting Prediction Market Prices as Probabilities.” NBER Working Paper No. 12200.',
      'Hasbrouck, J. (1995). “One Security, Many Markets: Determining the Contributions to Price Discovery.” Journal of Finance, 50(4), 1175–1199.',
    ],
  },
  {
    slug: 'attention-liquidity-screener',
    title: 'Attention, liquidity, and screener discipline in crowded books',
    summary:
      'Open prediction markets produce more contracts than any desk can watch. How attention and liquidity research inform Algomarket’s screener - and what Free vs Pro is for.',
    published: 'June 2026',
    category: 'Research',
    body: [
      {
        type: 'p',
        text: 'Every session, prediction markets mint more contracts than a human can meaningfully monitor. Social feeds optimize for drama; thin 1¢ markets scream; mid-probability political books with real volume often matter more for decision-relevant flow. A screener is not a prediction model - it is an attention allocator.',
      },
      {
        type: 'p',
        text: 'Economics and finance have long studied limited attention: agents cannot process all available signals, so prices and volumes reflect what gets noticed as much as what is true (see surveys in Hirshleifer & Teoh, 2003, on limited attention in capital markets). Prediction markets inherit the same constraint. Algomarket’s screener exists to impose deliberate filters before whale and live tools amplify noise.',
      },
      {
        type: 'h2',
        text: 'Filters as research instruments',
      },
      {
        type: 'ul',
        items: [
          'Volume floors - exclude books where a single retail ticket dominates the tape.',
          'Probability bands - mid ranges often carry more contested information than near-certainty quotes.',
          'Category and venue - politics, crypto, sports, and macro attract different participant mixes.',
          'Horizon - distant resolution dates change who shows up and how patiently capital sits.',
        ],
      },
      {
        type: 'stat',
        value: 'One job per pass',
        label:
          'Find candidates → inspect structure → then decide whether to watch or size. Do not run screener, live, and arbs as one screaming surface.',
        source: 'Algomarket desk playbook',
      },
      {
        type: 'pullQuote',
        text: 'Discipline is about what you ignore as much as what you open.',
        attribution: 'Algomarket research',
      },
      {
        type: 'h2',
        text: 'Where Free and Pro fit',
      },
      {
        type: 'p',
        text: 'The screener and whale dashboard ship on Free because they answer the first research question: what is worth looking at? Pro tools - live large fills and exposure rankings - answer the next question: what is happening now, and who is concentrated where? That sequencing mirrors how serious desks work: constrain the universe, then intensify monitoring (consistent with limited-attention framing in Hirshleifer & Teoh, 2003).',
      },
      {
        type: 'p',
        text: 'None of this invents hit rates. It is a methodology for allocating scarce attention across Polymarket and Kalshi books so that when you do open Pro flow tools, you are not drowning in every contract at once.',
      },
    ],
    references: [
      'Hirshleifer, D., & Teoh, S. H. (2003). “Limited Attention, Information Disclosure, and Financial Reporting.” Journal of Accounting and Economics, 36(1–3), 337–386.',
      'Wolfers, J., & Zitzewitz, E. (2004). “Prediction Markets.” Journal of Economic Perspectives, 18(2), 107–126.',
      'Arrow, K. J., et al. (2008). “The Promise of Prediction Markets.” Science, 320(5878), 877–878.',
      'Berg, J., Nelson, F., & Rietz, T. (2008). “Prediction Market Accuracy in the Long Run.” International Journal of Forecasting, 24(2), 285–300.',
    ],
  },
];

export function getResearch(slug: string): ResearchPiece | undefined {
  return RESEARCH.find((r) => r.slug === slug);
}

export function relatedResearch(slug: string): ResearchPiece[] {
  return RESEARCH.filter((r) => r.slug !== slug);
}
