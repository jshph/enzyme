/context endpoint should take plaintext queries of patterns...

# Supported patterns

## Tags:

* plain
  * "#relationships"
* with modifiers
  * "#relationships{<10}" - 10 most recent notes
  * "#relationships{>yyyy-mm-dd}" - notes created after a certain date
  * "#relationships{>1w}" - notes created in the last week
  * "#relationships{>1m}" - notes created in the last month

## Folders

* "inbox/"
* "Readwise/Podcasts/<10" - 10 most recent podcasts

## Markdown links

* "[[ecology of technology]]"
* "[[ecology of technology]]{>1w}" - notes created in the last week

## Multiple entities

* "inbox/ Readwise/Podcasts/<10" - 10 most recent inbox notes and 10 most recent podcasts

# Extraction Strategies

## Tag: whole file

If the tag appears in frontmatter, extract the whole file

## Tag: lasso context

If the tag appears in the context, extract before and after the tag.

## Markdown link

For markdown links, extract the contents of the file itself, and recent backlinks to it from files in the specified search folder in config.yml


# Next steps

- implement auth (gate after a few generation requests)
- some documentation in app about limitations for generation, without auth
- dashboard should be more refined; point to obsidian dir, and auth through dashboard
- deploy server and configure between prod and dev to point to it
- server metrics on how many requests per day, number of documents and tokens per doc, mayybee common tags.
- server configure how many docs to synthesize; client send 10+ per pattern. This allows us to collect metrics as well, on the distribution of docs and tokens per pattern.
- single scripts to run both electron and server
- persistence layer for auth

- plan for gating login:
  - settings beyond just the vault path

- plan for gating payment?
  - 10 requests per week free, or first 2 weeks, whichever comes first
  - limited number of docs per request
  - use sonnet
  - then paid will use sonnet
  - higher tier for more docs per request
  - more tier if custom prompts are wanted / raw context server functionality

goals for tonight
DONE:
- obsidian as primary, other sources secondary. make obsidian vault show up in menubar, along with other sources, but also have a call to actions in menubar to add other sources.
  - at minimum: substack as rss, blog rss
- in dashboard, have a way to connect other sources.
- develop some of the indexing of other sources
- display the sources in the menubar in compact way
- retrieving from embeds (for context server)
- more user friendly settings view that doesn't have all the fields for exclusion etc
- get it packaged to use on work laptop
- verify tests
- /enz command as context server
- verify behavior of zed extension by itself
- distribute the mcp
- alpinejs module in dashboard fix ui
- quit button
- more vanilla defaults for the electron app; hit select obsidian dir will open up dashboard
- supabase otp auth
- verificatino view states
- save settings to supabase
- remove rss feeds in view because they don't go into context
- track digests per user in supabase
- configure the prompts in the menubar, make that dynamic so that we can add more prompts server-side
- deploy the server to railway
- some ui stuff: dashboard view settings button is gray?
- machine specific vault paths / stored locally
- and a cozier brown theme for dashboard. brown accents and more prose-y in the menubar.
- refactor main.ts to make space for space routes
- space mvp implementation using rabbitmq
  - what is the most most most basic version of having people contribute to your vault. Have a URL that people can go to, available tags and entities, and submit entries.
- custom prompt templates -- one free one.
- space url
- mvp space page implementation for app.enzyme.garden
- rework landing page to hint at the release
- add app subdomain to the website or just have a page that allows people to submit to local garden urls -- simple form submission. (the page would need dynamic routes)
- copy space url should work
- rework settings page to make obsidian optional / onboardy
- make cold start work a little more smoothly -- shouldn't show saved settings, etc, that were in electron store
- "empty vault" scenario - maybe they don't use obsidian. change copy so that we can onboard people to obsidian vaults
- zed announce
- reddit anounce
- 2 blog posts
  - how to use it with zed
  - how to use it with claude
- refactor to react DONE

NEXT before launch:

- laern how to insert blockquotes programamticaly, without generating the ai all. Output format should be doc links followed by synthesis.
- implement the "digest" menu item in the editor - to extract mentions from the editor and retrieve docs from Enzyme, to synthesize them and output blockquotes with the docs as references.
- could also implement a plugin which is a view on the docs, link it to the editor


Brainstorming:

- a view on your thoughts anywhere you go --
  - which digests to the most relevant ones - metaprompting until you have a way to extract the question that surfaces the most relevant insights. A constantly evolving view, which you know by the question that was asked. And then a way to extend the question by posting it to your friends -- the most interesting question, you're creating a mirror for your friends. which you can share with a few of your thoughts.
  - allays the common critique that in an age of ai, we'll just be swimming in content that doesn't really matter to us. Contrary - we can shape the mirrors that most represent all that we've captured.



- prompt space should be as functional as original dashboard.html
- flow of vault digestion -> (optional) prompt -> create space (either from prompt or minimally) -> share space -> digest
- frequency of prompt execution

- twitter announce

- include link for contact

- link obsidian using chrome

- add a couple of templates for spaces and for prompts

- reminder system for prompts -- specifying when to digest and send notifications. -- a recurring system to synthesize your vault

- optional: query pattern support in prompt editor

- code signing / notarizing the app



NEXT after launch:

- draft some posts!!!

- rss feeds are a little unproven; can omit in release; make it easier to add prebuilt rss feeds
- custom prompting
- decide whether to support more basic stuff like uploading a single file or url
- modular push notifications - server side. Listenable.
  - configure disable notifications in dashboard

# Sharing roadmap

- figure out when to broadcast on zed forum
- create a twitter account
- share progress on obsidian subreddit and in discord, that this is acting as a context server for zed and for claude desktop app
- start drafting tweet threads (then to rt with jphorism account)
- reddit post should contain invitation to follow on x for tips and tricks

- the post should contain what i'm looking forward to next with it -- community vaults, insights and questions generated for communal knowledge... sparking peoples curiosity about how its going to make money

- should have back and forth about "what is a compelling demo" with an llm

# Feature Distribution Roadmap

## Current Implementation

### Menubar App (`index.html`)
- Basic settings configuration
- Directory selection
- Tag/pattern management
- Trending content visualization
- Status updates during indexing

### Dashboard (`dashboard.html`)
- Basic stats (indexed files, total tags)
- Cache size
- Server status
- Recent activity

## Recommended Feature Distribution

### Menubar App Features

1. **Vault Analysis** (Auto-refreshing)
   - Active capture patterns
     - Most used tags in last week/month
     - Most written-to folders
     - Recently created links
     - Common co-occurring tags
   - Content rhythms
     - Peak writing times/days
     - Average note length by folder/tag
     - Capture frequency patterns
   - Knowledge gaps
     - Orphaned notes/tags
     - Incomplete link references
     - Sparse areas in tag networks

2. **Question Synthesis Prompts**
   - Content-Based Prompts
     - "Generate 3 questions about implications of [concept X] for [domain Y]" 
     - "What questions would challenge the assumptions in [note Z]?"
     - "Ask about potential applications of [framework] to [context]"
   - Pattern-Based Prompts
     - "Generate questions exploring why [tag X] and [tag Y] often appear together"
     - "What questions would reveal gaps in this folder's organization?"
     - "Ask about connections between these frequently linked concepts"
   - Time-Based Prompts
     - "What questions would explore how [concept] has evolved in these notes?"
     - "Generate questions about why [topic] appears more frequently lately"
   - Gap-Based Prompts
     - "What questions would help connect these isolated notes?"
     - "Generate questions about unexplored areas between [concept X] and [concept Y]"

3. **Quick Actions**
   - Generate questions from selected prompt
   - Save generated questions to vault
   - Share questions with friends
   - Track responses and insights
   - Favorite effective prompts

4. **Status & Activity**
   - Analysis freshness
   - Prompt effectiveness stats
   - Response collection status
   - Sync status

**Rationale:** The menubar should prioritize features that benefit from quick access and don't require deep focus or analysis.

### Dashboard Features
Should handle more detailed analysis and configuration:

1. **Analytics & Visualization**
   - Detailed tag usage patterns
   - Response analytics from shared questions
   - Friend engagement metrics
   - Content pattern analysis
   - Heat maps of reflection activity

2. **Content Management**
   - Full tag management interface
   - Template management for questions
   - Response archive and organization
   - Bulk operations on content

3. **Advanced Settings**
   - Detailed indexing configuration
   - API integrations setup
   - Privacy and sharing preferences
   - Editor integration settings
   - Custom prompt engineering settings

4. **Social Features**
   - Friend management
   - Response quality tracking
   - Community engagement metrics
   - Anonymous sharing settings

## Implementation Suggestions

### Menubar Updates
- Update the menubar window to keep it small and focused:
  - Reduce default height (400-500px max)
  - Consider collapsible sections
  - Add quick action buttons
  - Implement toast notifications for updates

### Dashboard Expansion
- The dashboard window should:
  - Use a larger default size (1200x800 is good)
  - Implement proper routing for different sections
  - Consider a sidebar navigation
  - Support multiple open tabs/panels

### Data Flow
- Expand the current stats implementation:
  - Cache dashboard data more aggressively
  - Implement real-time updates only for critical metrics
  - Add background data processing for analytics
  - Support data export/import

## Rationale for Distribution

1. **User Experience**
   - Menubar should be instantly accessible and lightweight
   - Dashboard should handle "deep work" features
   - Avoid duplicating functionality between the two

2. **Technical Considerations**
   - Menubar app needs to stay performant and low-memory
   - Dashboard can handle heavier processing and data visualization
   - Separate concerns for better code maintenance

3. **Usage Patterns**
   - Menubar for frequent, quick interactions
   - Dashboard for scheduled, focused analysis sessions
   - Different UI/UX needs for each context



# Onboarding & Social Reflection Roadmap

## Phase 1: Menubar-First Onboarding

### Quick Start Flow (Menubar)
1. **Initial Setup Wizard**
   - Directory selection
   - Basic use case selection
   - Quick template selection for reflection patterns
   - Sample prompts based on selected use case

2. **Social Sharing Templates**
   - Pre-loaded reflection prompts
   - One-click copy for social sharing
   - Basic friend response tracking
   - Quick save for responses

3. **Pattern Suggestions**
   - Starter patterns based on folder structure
   - Common tag recommendations
   - Basic folder organization tips
   - Quick-access pattern library

### Success Metrics
- Time to first share
- Pattern adoption rate
- Response collection rate
- Template usage statistics

## Phase 2: Dashboard Integration

### Advanced Onboarding (Dashboard)
1. **Use Case Configuration**
   - Detailed workflow setup
   - Custom prompt engineering
   - Advanced pattern creation
   - Integration with existing structures

2. **Social Features Setup**
   - Friend group management
   - Response categorization
   - Privacy settings configuration
   - Sharing preferences

3. **Knowledge Base Configuration**
   - Folder structure optimization
   - Tag hierarchy setup
   - Custom metadata fields
   - Advanced pattern rules

## Phase 3: Educational/Enterprise Features

### Menubar Features
1. **Quick Classroom Actions**
   - Student response collection
   - Quick feedback sharing
   - Status notifications
   - Daily prompts

### Dashboard Features
1. **Educational Management**
   - Student progress tracking
   - Response analytics
   - Pattern recognition across submissions
   - Custom prompt templates

2. **Privacy & Security**
   - Role-based access control
   - Data anonymization settings
   - Export/import controls
   - Audit logging

## Implementation Strategy

### Stage 1: Personal Use (MVP)
1. **Menubar Focus**
   - Simple onboarding wizard
   - Basic pattern suggestions
   - Quick share templates
   - Response collection

2. **Limited Dashboard**
   - Basic configuration
   - Simple analytics
   - Pattern management

### Stage 2: Social Features
1. **Menubar Enhancements**
   - Friend quick-access
   - Share status tracking
   - Response notifications
   - Quick insights

2. **Dashboard Expansion**
   - Friend management
   - Response analytics
   - Pattern optimization
   - Share history

### Stage 3: Educational/Enterprise
1. **Menubar Adaptations**
   - Role-based quick actions
   - Status monitoring
   - Quick feedback tools
   - Class notifications

2. **Dashboard Extensions**
   - Administrative controls
   - Advanced analytics
   - Batch operations
   - Custom workflows

## Feature Distribution Rationale

### Menubar Priority
- First-time user experience
- Quick sharing workflows
- Response collection
- Status updates
- Daily engagement

### Dashboard Priority
- Detailed configuration
- Advanced patterns
- Analytics & insights
- User/group management
- System administration

## Success Metrics

### User Engagement
1. **Quick Actions (Menubar)**
   - Daily active users
   - Share frequency
   - Response collection rate
   - Pattern usage

2. **Deep Analysis (Dashboard)**
   - Session duration
   - Pattern complexity
   - Configuration completeness
   - Analytics usage

### Educational/Enterprise
1. **Classroom Metrics**
   - Student engagement
   - Response quality
   - Pattern effectiveness
   - Teacher efficiency

2. **Administrative Metrics**
   - User adoption
   - Feature utilization
   - System performance
   - Data quality

This roadmap emphasizes a "quick start" approach through the menubar while enabling deeper configuration and analysis through the dashboard, aligning with both personal and institutional use cases.


# more notes:

```typescript
interface VaultPattern {
  type: PatternType;
  content: {
    concepts: string[];
    relationships: Relationship[];
    frequency: number;
    timespan: Duration;
  };
  significance: number;
}

interface QuestionPrompt {
  template: string;
  requirements: {
    patternType: PatternType;
    minSignificance: number;
    contextNeeded: string[];
  };
  variables: string[];
}

// Analysis -> Prompt -> Questions flow
async function generateReflectionFlow(vault: Vault): Promise<ReflectionSession> {
  // 1. Analyze vault for interesting patterns
  const patterns = await analyzeVault(vault);
  
  // 2. Match patterns to appropriate prompts
  const promptSuggestions = patterns
    .filter(p => p.significance > THRESHOLD)
    .map(pattern => {
      const matchingPrompts = findPrompts(pattern);
      return { pattern, prompts: matchingPrompts };
    });
    
  // 3. Generate specific prompts with context
  const contextualizedPrompts = promptSuggestions.map(suggestion => {
    return hydratePrompts(suggestion.prompts, suggestion.pattern);
  });

  return {
    patterns,
    promptSuggestions,
    contextualizedPrompts
  };
}

// Example pattern detection
function detectConceptualTensions(notes: Note[]): VaultPattern[] {
  const patterns: VaultPattern[] = [];
  
  // Find concepts that appear in conflicting contexts
  const conceptMentions = new Map<string, Context[]>();
  
  for (const note of notes) {
    const concepts = extractConcepts(note);
    const context = analyzeContext(note);
    
    for (const concept of concepts) {
      const mentions = conceptMentions.get(concept) || [];
      mentions.push(context);
      conceptMentions.set(concept, mentions);
    }
  }
  
  // Look for concepts with divergent contexts
  for (const [concept, contexts] of conceptMentions) {
    if (hasSignificantDivergence(contexts)) {
      patterns.push({
        type: 'conceptual-tension',
        content: {
          concepts: [concept],
          contexts: contexts,
          frequency: contexts.length,
          timespan: getTimespan(contexts)
        },
        significance: calculateSignificance(contexts)
      });
    }
  }
  
  return patterns;
}

// Example prompt generation
function hydratePrompts(prompts: QuestionPrompt[], pattern: VaultPattern): string[] {
  return prompts.map(prompt => {
    let hydratedPrompt = prompt.template;
    
    // Replace variables with actual content
    for (const variable of prompt.variables) {
      const value = extractValue(variable, pattern);
      hydratedPrompt = hydratedPrompt.replace(`{${variable}}`, value);
    }
    
    return hydratedPrompt;
  });
}
```

The key points of this approach:
Vault analysis identifies interesting patterns, relationships, and gaps
These patterns match to question-generating prompts
Prompts help users generate specific reflection questions
Questions can be used personally or shared with others
The system learns which prompts generate valuable questions
For example:
Analysis finds frequent co-occurrence of "#technology" and "#ethics"
Matches to pattern-based prompt template
Generates: "Generate 3 questions about how ethical principles in your notes could guide technology development"
4. User uses this prompt to generate specific questions
Questions can be used for personal reflection or shared for discussion
This creates a structured flow from content analysis through prompt generation to actual questions, while keeping the user in control of the final questions.
