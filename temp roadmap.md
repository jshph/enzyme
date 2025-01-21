enzyme shoudl be more robust so that it can live as a desktop app and not break half the time...
i should look at subsidizing cost for it too
hide the spaces and playground functionality for now
prompt builder should show the most common tags and maybe the graph view for the tags 
make sure scheduled prompting works -- sent to an email
- prompt builder should be the plate app right in the prompts page. have it have minimal formatting. But the reason to have that there is to render the relevant docs inline. And to visualize the output format of it.
- MVP is to start with tags, then come up with better questions, or to select a template smartly based on those tags. part of that may be to show the tags in a graph view, so port that over. But otherwise there should be a tag picker with which you can use to "automatically create a relevant question" in this prompt builder.


- [x] click tags to add them to the editor ✅ 2024-12-21
- [ ] move the docs that are rendered to a "suggested output" view

## Specification for Output View

### Overview
The output view will be designed to display various types of content in a modular format, allowing for user interaction and customization.

### Features
- **Block Display**: The interface will present "blocks," each containing a distinct type of output (e.g., questions, lists of documents).
- **User Interaction**: Users will have the ability to drag and edit these blocks, which will modify the output format. (Note: This feature will not be included in the initial version.)
  
### Data Flow
1. **Entities**: Users will add tags or entities to act as queries.
2. **Suggested Prompt**: Based on the entities, users will select a configuration that includes a suggested prompt and suggested output.
3. **Scheduled Persistence**: The selected suggested prompt will be saved as "scheduled."
4. **Output Generation**: The suggested output represents what the LLM is expected to generate when the scheduled prompting is executed.

### Purpose
The initial version will include curated suggested outputs to ensure proper formatting and usability.

### Vision
- **Template-Based Rendering**: The system will utilize a zed template format, with sections indicated by angle brackets, allowing for flexible UI prototyping.
- **Render Components**: The output can evolve into renderable components based on user interaction.

### Component Examples
- **Relevant Documents**: Display documents relevant to the user's query.
- **Song Structure**: Visualize structures such as verse/chorus/verse based on a lyrics tag.
- **Prompts and Questions**: Generate prompts or questions to address knowledge gaps.

### Report Examples
- **Dynamic Reports**: Create reports that include various elements such as:
  - Mantras
  - Strength and stress assessments
  - Quotes

### Editing and Scheduling
- Users can select from multiple renderings and hit "edit" to modify the contents in the editor.
- Instead of altering the content directly, users will edit the underlying template.
- An "insertable templates" menu will be available in the toolbar, allowing users to modify prompts associated with templates.
- Users will have the option to schedule the dynamic report for email delivery, facilitating regular updates.


DONE:
implementation notes:
- relevant doc extraction should extract around the mention itself. so it'll be important to funnel that metadata around the mention.
- before we have a scheduling feature, we need to have the prompt structured output be something really compelling
- get an apple developer account
- start of email should have a "vanity" or "reflection" section which describes to the user how well they are doing to reflect on their notes -- maybe some quantified metric about frequency and freshness of visiting a topic, (i.e. some fun facts - last age of visited topic) and suggested action items around timeliness of revisiting a topic, and things to not forget. Goal is to help them feel accomplished about the connections between their notes.
- remove the temp stuff that hardcodes recipe execution
- "profiles" for generating recipes - purpose of vault can be self reflection, or project management, or relationship management / CRM
- prompt engineering for the metaprompt (it's too confusing right now, it generates a prompt for the user and not the llm)
- migrate the api key to server side / the gen to server side (consider using streamObjects)
- from prompt to make it a question
- setup scheduling email of a recipe
- a few more templates - mantras
- retry generation should work
- move timeline view to the top above the ingredients
- work on the interactivity consistency. also make the range indicator persist when an entity is selected.
- quick demo video for people to see it tomorrow and give some feedback
- selected range should apply to the query step
- less glitchy index initialization step
- fix the dragging causing elements to deselect
- dock should work
- fix double notification of "index complete"
- fix the scheduling -- no context provided
- recipe view should be accessible if not logged in, but cannot save recipe or execute more than twice
- "email me a copy" button to send the current version to email - and to schedule over the server
- open button should open the file in obsidian
- track executions as a table in supabse and compare to a hardcoded limit server side
- swap to using deepseek v3
- draggable from anywhere in the window
- streaming output sections
- revise copy of the recipe view so it's easier to understand and onboard
- graph view:
  - width of window to 1400, graph ratio to 4/3
  - make sure the count is reflected properly, it's too few right now
  - reduce font size to 10pt
  - highlight the mentioned node but not all of the one hops from its docs
  - ensure that selected ids which are 1 hops are highlighted, not just because they are 1-hops
  - make sure edge highlighting is valid - maybe lower opacity overlay
  - adjust colors to theme colors not lightgree
  - fix bugs with one hop mentions not being connected to one hop mentions of other docs
  - play around with forces for mentions and  docs
  - drag extents should be clearer or feel more seamless (have a halo that expands, and have a snap animation or something)
- graph should work with links, not just tags. Folders should be selectable but they should not appear as one hops
- debug the node remainder logic
- login view needs to have more info 
- there is a delay in between finishing indexing and seeing the tags. There might have been some new work that indexing has to do that is slow. Could be timeline logic
- when changing vaults, the tags should be updated
- generation termination states; might need cleaner reset logic
- tokens should be cleaner tracked + figure out lifetime of a token
- see if i can develop tools for the context server protocol so that the query language is not so manual
  - having it work with zed, claude, obsidian, and on its own would be great
- email icons should display properly
- email otp

TODO before launch

- graph should clear when changing vaults
- counts shoudl decrease correctly
- tag count should be over the last 3 months, not just the last 30 days
- logo should be copied as resource and be used


- verify the behavior of scheduled recipes
- scheduled recipes shoudl update when scheduled

- don't hallucinate, error out when there aren't any files so we aren't synthesizing just a few



- figure out onboarding - revisit obsidian notes (things like auto tagging, etc)
  - should consider doing 30 mins or so of an auto tagging and titling workflow by building an obsidian plugin
  - might need a notebook to prototype / prompt engineer the titles that were generated. Using a repl might be easier than having an obsidian plugin.

- "remove recipe" button which forwards to enzyme.garden success page

- think more about a "sharable" version of the email... one that doesn't expose your raw notes, makes it possible for you to share with others.


- think through pitching an autotagging version and propose a survey for people who don't have tagging so i can gather their use cases for needing tags

LATER
- editable "prompt" for each segment

- think about how autotagging workflow can help reorganize content from drive and then surface it to claude desktop as a personal assistant -- can paste as project notes

- promote on claudeai, pkm, obsidian subreddit
- import step -- take a scrivener etc and then auto tag it and create a vault
- self organizing workspace: tool use can retrieve metadata about top folders and tags etc and then use that to determine which notes to retrieve and how to treat them
  - "now that tiktok is banned, do you have more time to noodle on an idea?"


<!-- 
# Sketching out the Prompt Builder / Recipe Home

Copy should reflect:
- end goal is a recipe with an example of what the current "instance" looks like (sources and synthesis sections)
- where the user starts is "adding ingredients" -- their tags and links -- which the engine fetches and uses to produce a recipe and an instantiation of it

Need better branding for this -- audience is:
- PKM nerds (practical, engineering types, maybe writing types)
- Professional knowledge workers

Goals for the copy + flow on that page:
- Tone of the title + branding needs to be professional. But also, mostly getting out of the way. The objective is to explore notes. This UI is just a workflow.
- Show only what the user needs in order to get started with this workflow / know what it does for them

(in the base case, just present multiple options of suggested outputs in different tabs and styles, and allow the user to choose between one of them without editing them) -->
- [ ] and then once all this is done, embed the graph viz underneath the prompt builder. include a heatmap view of tag use over time.. hovering over one of the items will render the note in context
	- could have scrubbable timeline view - drag earlier than just a month ago to see the tags and entities change. Or to see the graph view change (updated outlinks etc)... but have the graph view 

refactor the obsidian plugin to use this as a backend
set the milestones and not have it be dependent upon waiting for betaworks to get me in
but also calibrate these goals against my personal mantras for the new year
prompt modification - should be an editor (which is separate from the playground itself)

whats the moat / easy entry point -- autolabel or insert tags somehow. Could do simple keyword based or use on device AI to save on the costs of processing large documents... but this is really for a different customer set than the people with existing knowledge base

the reason that i think helping someone create a prompt is interesting / promising is that "closet is messy" - this is to help people be hospitable to their own thoughts. This is the type of scaling that i think that i want to do / help with #hospitality #enzyme/pmf 

use cases for tags -- maybe try autotagging a project roadmap doc which attempts to put tags in an organization and categorize and chunk all the information there so that you can visualize it as a network of actionable or latent stuff