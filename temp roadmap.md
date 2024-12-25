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



TODO before launch
- editable "prompt" for each segment
- "send" button to send the current version to email
- setup scheduling email of a recipe
- retry generation should work
- from prompt to make it a question
- a few more templates - mantras

LATER
- ui selecting a recipe

- nice to have would be to build in the graph visualization stuff that i had before
- also want this to be performant -- can some of the processing happen in the background without awaits
  - optimize for startup -- we need the settings to initialize faster than the rest of the UI renders; the prompt builder may not have its tags ready yet, but that's okay, we should have more of the UI have "loading" indicators for when indexing is happening.
- there's definitely a bug that reflects the index doesn't have enough docs because the output gets hallucinated. Need to fix that -- before submitting prompt the index should be run. Noticing this happens when i navigate tabs to Prompt, possibly interrupting a process

finalizing steps...
- get an apple developer account
- migrate the api key to server side / the gen to server side (consider using streamObjects)

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

- editable prompt - button to regenerate a section, or just make it an input box
  - benefits: can choose a new output format for the segment - could be mantra rather than synthesis, for example.
- selecting an entity will show default # of docs for that, but allow the user to change it using buttons


	- this requires a custom component in plate which will render docs given a URL
- [ ] "create prompt" button

- [ ] shorter editor
- [ ] and then once all this is done, embed the graph viz underneath the prompt builder. include a heatmap view of tag use over time.. hovering over one of the items will render the note in context
	- could have scrubbable timeline view - drag earlier than just a month ago to see the tags and entities change. Or to see the graph view change (updated outlinks etc)... but have the graph view 

could also refine prompt mapping --- should select from one of a few different types of prompts to generate - based on what is useful (or perplexity style - show the other suggested questions beneath it)

and then also enable the user to refine what type of prompt they would find most useful

make sure the digest functionality works
have some default prompts, one of which is the resolution / enneagram one
refactor the obsidian plugin to use this as a backend
set the milestones and not have it be dependent upon waiting for betaworks to get me in
but also calibrate these goals against my personal mantras for the new year
prompt modification - should be an editor (which is separate from the playground itself)

whats the moat / easy entry point -- autolabel or insert tags somehow. Could do simple keyword based or use on device AI to save on the costs of processing large documents... but this is really for a different customer set than the people with existing knowledge base

the reason that i think helping someone create a prompt is interesting / promising is that "closet is messy" - this is to help people be hospitable to their own thoughts. This is the type of scaling that i think that i want to do / help with #hospitality #enzyme/pmf 

use cases for tags -- maybe try autotagging a project roadmap doc which attempts to put tags in an organization and categorize and chunk all the information there so that you can visualize it as a network of actionable or latent stuff