require('dotenv').config();

const express = require('express');
const path = require('path'); 

const app = express();
const port =  process.env.PORT || 3000 

const {Client} = require("@gradio/client") ;
const hf_token = process.env.hf_token;

const QLOO_API_KEY = process.env.QLOO_API_KEY;

const  { GoogleGenAI } = require ("@google/genai");
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY});

const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.supabaseUrl;
const supabaseKey = process.env.supabaseKey;

const supabase = createClient(supabaseUrl, supabaseKey)

//Global variables
const maxStoryLength = 61; //number of segments
const language = 'english';
const foreign_language = 'spanish';
let n = 20; //number of words
const type_word = 'common'

//Global functions
async function checkSession(maxRetries = 3, initialDelayMs = 3000, maxDelayMs = 50000) {
    // Validate input parameters to prevent infinite loops or unexpected behavior
    if (maxRetries < 0) {
        throw new Error("maxRetries must be a non-negative number.");
    }
    if (initialDelayMs < 0) {
        console.warn("initialDelayMs should be a non-negative number. Setting to 0.");
        initialDelayMs = 0;
    }
    if (maxDelayMs < 0) {
        console.warn("maxDelayMs should be a non-negative number. Setting to initialDelayMs.");
        maxDelayMs = initialDelayMs;
    }
    if (maxDelayMs < initialDelayMs) {
        console.warn("maxDelayMs cannot be less than initialDelayMs. Setting maxDelayMs to initialDelayMs.");
        maxDelayMs = initialDelayMs;
    }


    let currentDelay = initialDelayMs;

    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) { // +1 because it try once, then retry `maxRetries` times
        try {
            const { data: { session }, error } = await supabase.auth.getSession();

            if (error) {
            console.warn(`Attempt ${attempt} of ${maxRetries + 1}: Supabase session error: ${error.message}`);

            if (attempt >= maxRetries + 1) {
                throw new Error(`Failed to fetch session after ${maxRetries + 1} attempts: ${error.message}`);
            }

            // Apply exponential backoff with a maximum delay cap
            await new Promise(resolve => setTimeout(resolve, currentDelay));
            currentDelay = Math.min(currentDelay * 2, maxDelayMs);

            } else {
                return session;
            }
        } catch (e) {
            // Catch any unexpected errors 
            console.error(`Attempt ${attempt} of ${maxRetries + 1}: An unexpected error occurred: ${e.message}`);

            // If it's the last attempt and still an error, re-throw it
            if (attempt >= maxRetries + 1) {
                throw new Error(`Failed to fetch session after ${maxRetries + 1} attempts due to unexpected error: ${e.message}`);
            }

            // Apply exponential backoff with a maximum delay cap
            await new Promise(resolve => setTimeout(resolve, currentDelay));
            currentDelay = Math.min(currentDelay * 2, maxDelayMs);
        }
    }
    throw new Error("Reached end of retry loop without success or explicit error. This should not happen.");
}

// --- Configure EJS as the view engine ---
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'templates')); 

// Middleware to parse JSON request bodies
app.use(express.json());

// Serve static files (CSS, JS) from the 'static' directory
app.use('/static', express.static(path.join(__dirname, 'static')));

app.get('/', async (req, res) => {
    let savedStoriesData = []; 
    let errorMessage = null;
    let session = null;

    try {
        session = await checkSession();
    } catch (err) {
        console.error('Error fetching user session in index:', err.message);
        errorMessage = 'Could not verify your session. Please try signing in again.';

        return res.render('index', {
            stories: savedStoriesData, 
            errorMessage: errorMessage,
            session: session 
        });
    }
    if (session){
        try {
            const { data, error } = await supabase
                .from('novel')
                .select('title, story_id,ended')
                .order('updated_at', { ascending: false });

            if (error) {
                console.error('Error fetching stored stories:', error);
                errorMessage = 'Failed to load your stories. Please try again later.';
            } else {
                savedStoriesData = data;
            }
        } catch (err) {
            console.error('An unexpected error occurred while fetching stories:', err);
            errorMessage = 'An unexpected error occurred while fetching stories.';
        }
    }
    
    return res.render('index', {
        stories: savedStoriesData, 
        errorMessage: errorMessage,
        session: session },
    );
})


app.get('/search', async (req, res) => {
    let session = null;
    let errorMessage = null;
    try {
        session = await checkSession();
    } catch (err) {
        console.error('Error fetching user session in /search:', err.message);
        errorMessage = 'Could not verify your session. Please try signing in again.';

        return res.render('search', { 
            errorMessage: errorMessage,
            session: session 
        });
    }
    res.render('search',{
        session: session,
        errorMessage: errorMessage
    }); 
});

app.get('/auth',(req,res)=>{
    res.render('auth');
})


app.get('/preferences', async (req, res) => {
    async function fetchPreferences (){
        const { data, error } = await supabase
        .from('taste')
        .select('entity->>name,entity->>type,entity->>image_url,entity->>release_year')
        if (error){
            console.error('Error fetching preferences data', error);
            throw new Error('Failed to fetch preferences:', error)
        }
        return data;
    }

    try{
        const session = await checkSession();
        const preferencesData = await fetchPreferences();

        if (preferencesData && preferencesData.error) { 
            console.error('Supabase error received in /preferences route:', preferencesData.error);
            res.status(500).send('Error loading preferences: ' + preferencesData.error.message); 
            return;
        }
        res.render('preferences',{items: preferencesData,session:session});
    } catch (routeError) { 
        console.error('Unexpected error in /preferences route:', routeError);
        res.status(500).send('An unexpected server error occurred.');
    }
});

app.get('/words', async (req, res) => {
    async function fetchWords (){
        const { data, error } = await supabase
        .from('stones')
        .select('base_words,getting_used_words,comfortable_words')
        if (error){
            console.error('Error fetching words data', error);
            throw new Error('Failed to fetch words:', error)
        }
        const base_words = data[0]?.base_words?? [];
        const getting_used = data[0]?.getting_used_words ?? [];
        const comfortable = data[0]?.comfortable_words ?? [];
        return {base:base_words,getting:getting_used,comfortab:comfortable};
    }
    try{
        const session = await checkSession();
        const wordsData = await fetchWords();

        if (wordsData && wordsData.error) { 
            console.error('Supabase error received in /words route:', wordsData.error);
            res.status(500).send('Error loading words: ' + wordsData.error.message); 
            return;
        }
        res.render('words',{words: wordsData,session:session});
    } catch (routeError) { 
        console.error('Unexpected error in /words route:', routeError);
        res.status(500).send('An unexpected server error occurred.');
    }
})

app.get('/story',async(req,res)=>{
    const storyId = req.query.storyId

    if (storyId){
        res.render('story')
    } else {
        res.status(400).send('Story Id is required')
    }
})

app.get('/api/entities', async (req, res) => {
    const searchQuery = req.query.query;

    if (!searchQuery) {
            return res.status(400).json({ error: "Search query is required" });
        }

        const headers = {'accept': 'application/json', 
                        'X-Api-Key': QLOO_API_KEY};

        const paramsSearch = new URLSearchParams({
            'query':searchQuery,
            'types':'urn:entity:movie,urn:entity:tv_show,urn:entity:book',
            'page':'1',
            'sort_by':'match'
        })
        const options = {'method': 'GET', 
                    'headers': headers,
    };
    try {
        const searchResponse = await fetch(`https://hackathon.api.qloo.com/search?${paramsSearch}`, options)

        if (!searchResponse.ok) {
            let errorDetails;
            try {
                errorDetails = await searchResponse.json();
            } catch (parseError) {
                errorDetails = await searchResponse.text();
            }
            console.error(`Qloo API Search Error (HTTP ${searchResponse.status}):`, errorDetails);
            return res.status(searchResponse.status).json({
                error: `Qloo API Search Error: ${searchResponse.statusText || 'Unknown error'}`,
                details: errorDetails
            });
        }

        const searchData = await searchResponse.json()

        const results = [];
        for (const entity of searchData.results || []) {
            const name = entity.name;
            const imageUrl = entity.properties?.image?.url; // Optional chaining for safe access
            const releaseYear = entity.properties?.release_year || entity.properties?.publication_year;

            // Only include entities that have a name and an image URL
            if (name && imageUrl) {
                const parsedEntity = {
                    id: entity.entity_id,
                    name: name,
                    image_url: imageUrl,
                    // Clean up type from URN (e.g., "urn:entity:book" -> "book")
                    type: entity.types && entity.types.length > 0 ? entity.types[0].replace("urn:entity:", "") : "N/A",
                    release_year: releaseYear
                };
                results.push(parsedEntity);
            }
        }
        res.json(results);

    } catch (error) {
        console.error("Error during /api/entities operation:", error.message);
        res.status(500).json({ error: `Network or unexpected error during search: ${error.message}` });
    }
}); 

app.post('/api/entity', async (req, res) => {
    const entityId = req.body.id; 

    if (!entityId || typeof entityId !== 'string' || entityId.trim() === '') {
        return res.status(400).json({ error: "Invalid Qloo Entity ID provided." });
    }


    const tagsFilterEntity = `urn:tag:characteristic:qloo,urn:tag:genre:media,urn:tag:archetype:qloo,
                            urn:tag:audience:qloo,urn:tag:character:qloo,urn:tag:keyword:qloo,urn:tag:plot:qloo,
                            urn:tag:style:qloo,urn:tag:subgenre:qloo,urn:tag:theme:qloo`
    
    const typeEntities = ['urn:entity:artist','urn:entity:movie','urn:entity:destination'];

    const tagsFilterCrossEntity = `urn:tag:characteristic:qloo,urn:tag:archetype:qloo,
                        urn:tag:character:qloo,urn:tag:plot:qloo,urn:tag:style:qloo,
                        urn:tag:subgenre:qloo`

    const narrativeTags = {
        story_pace:[],
        story_destination:{destinations:[],characteristic:[]},
        plot_description: [],
        characters_description: [],
        audience: [],
        story_theme: []
    };

    //Helper function to filter tags and return directly its value  
    function filterMap(tags, typeTag) {
        return tags
            .filter(tag => Object.keys(tag)[0] === typeTag)
            .map(tag => tag[typeTag]);
    }

    function processTags(inputArray) {
        const uniqueTags = new Set();
        const outputTags = [];

        for (const itemDict of inputArray) {
            for (const key in itemDict) {
                if (Object.prototype.hasOwnProperty.call(itemDict, key)) {
                    // Parse the key to get type and source
                    const parts = key.split(':');
                    if (parts.length >= 3) {
                        const tagType = parts[2];
                        const tagSource = parts[3];

                        // Format the value for uniqueness check (lowercase)
                        // and for the final output string
                        const value = itemDict[key];
                        const processedValue = value.toLowerCase();

                        // Create the desired output string format
                        // The format is type:source:value (using the original case of value for output)
                        const formattedTag = `${tagType}:${tagSource}:${value}`;

                        // Use the lowercase processed value for unique checking
                        if (!uniqueTags.has(processedValue)) {
                            uniqueTags.add(processedValue);
                            outputTags.push(formattedTag);
                        }
                    } else {
                        console.warn(`Warning: Unexpected key format '${key}' while processing raw tags`);
                    }
                }
            }
        }
        return outputTags;
    }

    function processResultsModel(results,data){
        const narrativeElements = [
            "audience",
            "characters",
            "characters_archetype",
            "characters_description",
            "characters_elements",
            "characters_related_nouns",
            "characters_relationship",
            "characters_role",
            "other",
            "plot_archetype",
            "plot_description",
            "settings_description",
            "settings_places",
            "settings_styles",
            "settings_time",
            "story_genre",
            "story_pace",
            "story_style",
            "story_subgenre",
            "story_theme",
            "story_tone",
            "story_topic"
        ];

        for (let i=0;i<results.length;i++){
            let tag = results[i].text;
            const parts = tag.split(':');
            
            if (parts.length >= 3) {
                tag = parts[2];
            } else{
                console.warn(`Warning: Unexpected tag format '${tag}' while processing model results`);
            }
            let tagCategory = results[i].predicted_label;

            for (let element of narrativeElements){
                if (tagCategory === element){
                    if(data[element]){
                        data[element].push(tag)
                    } else {
                    data[element] = []
                    data[element].push(tag)
                    }
                }
            }
        }
        return data;
    }
    async function callModel(tags){
        let processedTags = null;
        let updatedData = null;

        if (Array.isArray(tags) && tags.length>0){
            processedTags = processTags(tags);
        }

        if (processedTags!==null){
            const clientHf = await Client.connect("orph19/TestOfTagClassifier",{hf_token:hf_token});

            const modelData = await clientHf.predict("/predict", { 		
                tags: processedTags
            });

            if (!modelData || !modelData.data || !modelData.data[0] || !modelData.data[0].predictions) {
                throw new Error("Invalid or unexpected model response structure.");
            }

            updatedData = processResultsModel(modelData.data[0].predictions,narrativeTags)

        }
        return updatedData;
    }                 
    async function searchEntityWithId(){
        const urlParams = new URLSearchParams({'entity_ids': entityId});
        const response = await fetch(`https://hackathon.api.qloo.com/entities?${urlParams}`, {
            'method': 'GET',
            'headers': {
                'accept': 'application/json',
                'X-Api-Key': QLOO_API_KEY}
        }) 

        if (!response.ok) {
            let errorDetails;
            try {
                errorDetails = await response.json();
            } catch (parseError) {
                errorDetails = await response.text();
            }
            console.error(`Qloo API /entities Error (HTTP ${response.status}):`, errorDetails);
            throw new Error('Qloo API Entity Fetch Error:', response.statusText || 'Unknown error');
        };

        const data = await response.json();

        const entity = data.results && data.results.length > 0 ? data.results[0] : null;//entityToSave

        if (!entity) {
            throw new Error("Entity data not found from Qloo for the given ID.");
        }

        return entity;

    }
    
    async function getInsightOfEntity(id,typeTags){
        const params = new URLSearchParams({
            'filter.type':'urn:tag',
            'signal.interests.entities': id,
            'filter.tag.types': typeTags,
            'take': 25
        });
        const response = await fetch(`https://hackathon.api.qloo.com/v2/insights/?${params}?`,{
            'method': 'GET',
            'headers': {
                'accept': 'application/json',
                'X-Api-Key': QLOO_API_KEY}
        });

        if (!response.ok) {
            let errorDetails;
            try {
                errorDetails = await response.json();
            } catch (parseError) {
                errorDetails = await response.text();
            }
            console.error(`Qloo API /v2/insights Error (HTTP ${response.status}):`, errorDetails);
            throw new Error('Qloo API Insight Fetch Error:',response.statusText || 'Unknown error');
        };
        
        const data = await response.json();
        const tags = data?.results?.tags && data.results.tags.length > 0 ? data.results.tags : [];

        const affinityTags = tags.map(tag =>{ //THIS PART
            return {[tag.subtype]: tag.name};
        });

        return affinityTags; 
    }

    async function getCrossDomainEntities(){
        const crossEntitiesToSave = [];

        for (const type of typeEntities) { 
            const params = new URLSearchParams({
                'filter.type': type,
                'signal.interests.entities': entityId,
                'take': 1,
                'page': 1
            }); 

            const response = await fetch(`https://hackathon.api.qloo.com/v2/insights/?${params}`,{
                'method': 'GET',
                'headers': {
                    'accept': 'application/json',
                    'X-Api-Key': QLOO_API_KEY}
            });

            let data;

            if (!response.ok) {
                if (response.status === 400) {
                    data = null;
                } else {
                    let errorDetails;
                    try {
                        errorDetails = await response.json();
                    } catch (parseError) {
                        errorDetails = await response.text();
                    }
                    console.error(`Qloo API /v2/insights Error (HTTP ${response.status}):`, errorDetails);
                    throw new Error('Qloo API Insight Fetch Error:',response.statusText || 'Unknown error')
                }
            } else {
                data = await response.json();
            }

            
            if (data && data.results && data.results.entities && data.results.entities.length > 0) {
                const crossEntity = data.results.entities[0];
                //After fetching ids, search for the affinity towards tags of the cross entity
                const insightTags = await getInsightOfEntity(crossEntity.entity_id,tagsFilterCrossEntity);

                const crossEntityData = {
                    'entity_type': crossEntity.subtype,
                    'tags': (crossEntity.tags || []).map(tag => {
                            return {
                                [tag.type]: `${tag.name}`
                            };
                        }),
                    'affinity_tags': insightTags
                }

                crossEntitiesToSave.push(crossEntityData);
            }
        }

        return crossEntitiesToSave;
    }

    try {

        const entityToSave = await searchEntityWithId()

        // Extract required fields for data base
        const entityData = {
            qloo_entity_id: entityToSave.entity_id,
            name: entityToSave.name,
            image_url: entityToSave.properties?.image?.url,
            type: entityToSave.types && entityToSave.types.length > 0 ? entityToSave.types[0].replace("urn:entity:", "") : "N/A",
            release_year: entityToSave.properties?.release_year || entityToSave.properties?.publication_year,
            description: entityToSave.properties?.description,
            short_description:  entityToSave.properties?.short_description
        };

        const selectedTags = (entityToSave.tags || [])
        .filter(tag => tag.type !=='urn:tag:streaming_service:media' && tag.type !=='urn:tag:wikipedia_category:wikidata')
        .map(tag => {
            return {[tag.type]:tag.name}
        });

        const affinityTags = await getInsightOfEntity(entityId,tagsFilterEntity)

        const rawEntityTags = [...selectedTags, ...affinityTags];

        let rawNarrativeTags = [...rawEntityTags];
        
        const rawRecommendedTags = []; //Potential tailored information

        const crossEntitiesToSave = await getCrossDomainEntities();
 
        if (crossEntitiesToSave.length > 0) {
            for (const crossEntitySave of crossEntitiesToSave) {

                if (crossEntitySave.entity_type === 'urn:entity:book') { 
                    rawRecommendedTags.push(crossEntitySave.tags);
                    rawRecommendedTags.push(crossEntitySave.affinity_tags);

                } else if(crossEntitySave.entity_type === 'urn:entity:movie'){
                    rawRecommendedTags.push(crossEntitySave.tags);
                    rawRecommendedTags.push(crossEntitySave.affinity_tags);
                    
                } else if (crossEntitySave.entity_type === 'urn:entity:artist') {
                    narrativeTags.story_pace = filterMap(crossEntitySave.tags,'urn:tag:genre:music'); //Add directly to the narrative components
                    rawNarrativeTags = [...rawEntityTags,...crossEntitySave.affinity_tags];

                } else if (crossEntitySave.entity_type === 'urn:entity:destination') { 
                     //Add directly to the narrative components
                    narrativeTags.story_destination.characteristic = filterMap(crossEntitySave.affinity_tags,'urn:tag:characteristic:qloo');
                    narrativeTags.story_destination.destinations = filterMap(crossEntitySave.tags,'urn:tag:genre:destination');
                }
            }
        }

        //Add certain tags directly to the narrative components
        narrativeTags.plot_description = filterMap(rawNarrativeTags,'urn:tag:plot:qloo');

        narrativeTags.characters_description = filterMap(rawNarrativeTags,'urn:tag:character:qloo');

        narrativeTags.audience = filterMap(rawNarrativeTags,'urn:tag:audience:qloo');

        narrativeTags.story_theme = filterMap(rawNarrativeTags,'urn:tag:theme:qloo')

        const updatedNarrative = await callModel(rawNarrativeTags)

        let narrative;

        if (updatedNarrative===null){
            narrative = narrativeTags;
        } else {
            narrative = updatedNarrative;
        }

        const {data,error} = await supabase
        .from('taste') 
        .insert([{
            entity: entityData, 
            raw_narrative_tags: rawNarrativeTags,
            raw_recommended_tags: rawRecommendedTags,
            narrative: narrative
        }]) 
        .select(); 

        if (error) {
            if (error.code === '23505') {
                console.warn("Duplicate data was detected while inserting new entity")
                return res.status(404).json({message:'The entity is already added'})
            } else {
                console.error('Error inserting data to Supabase:', error.message);
                return res.status(500).json({ message: 'Failed to save the identity to Supabase.', details: error.message });
            }
        }

        res.status(201).json({ 
            message: "Entity successfully added to preferences!",
            data: data[0] 
        }); 

    } catch(error){
        console.error("Error during /api/entity operation:", error.message);
        res.status(500).json({ error: `An unexpected server error occurred: ${error.message}` });
    }
})

app.post('/api/stories', async(req,res)=>{
    //Helper function to select random entities 'narrative' values 
    function getRandomElements(arr, num) {
        // Create a copy of the array to avoid modifying the original
        const shuffled = [...arr]; 
        let currentIndex = shuffled.length, randomIndex;

        while (currentIndex !== 0) {
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;

            [shuffled[currentIndex], shuffled[randomIndex]] = [
            shuffled[randomIndex], shuffled[currentIndex]
            ];
        }

        return shuffled.slice(0, num);
    }
    //Helper function to merge the selected 'narrative' values in a single object 
    function mergeElements(inputArray) {
        const mergedNarrative = {};

        //All possible keys in the narrative object
        const keys = [
                "audience",
                "characters",
                "characters_archetype",
                "characters_description",
                "characters_elements",
                "characters_related_nouns",
                "characters_relationship",
                "characters_role",
                "plot_archetype",
                "plot_description",
                "settings_description",
                "settings_places",
                "settings_styles",
                "settings_time",
                "story_genre",
                "story_pace",
                "story_style",
                "story_subgenre",
                "story_theme",
                "story_tone",
                "story_topic"
            ];

        // Initialize each key in the merged object with an empty array
        keys.forEach((key) => {
            mergedNarrative[key] = [];
        });


        inputArray.forEach((item) => {
            if (item.narrative) {
                keys.forEach((key) => {
                    if (Array.isArray(item.narrative[key])) {
                        mergedNarrative[key] = mergedNarrative[key].concat(item.narrative[key]);
                    }
                });
            }
        });

        return mergedNarrative;
    }
    //Helper function to randomly select n element from each object's key value 
    function getRandomElementsFromEachArray(inputObject, numberOfElements = 2) {
        const result = {};

        for (const key in inputObject) {
            if (Object.hasOwnProperty.call(inputObject, key)) {
            const originalArray = inputObject[key];
            

            if (Array.isArray(originalArray) && originalArray.length > 0) {
                const freeDuplArray = removeCaseInsensitiveDuplicates(originalArray)
                const shuffled = [...freeDuplArray];
                let currentIndex = shuffled.length;
                let randomIndex;

                while (currentIndex !== 0) {
                randomIndex = Math.floor(Math.random() * currentIndex);
                currentIndex--;
                [shuffled[currentIndex], shuffled[randomIndex]] = [
                    shuffled[randomIndex],
                    shuffled[currentIndex],
                ];
                }

                result[key] = shuffled.slice(0, Math.min(numberOfElements, freeDuplArray.length));
            } else {
                result[key] = [];
            }
            }
        }
        return result;
    }

    function editWords(arrayToEdit, wordsToRemove, wordsToAdd=[]) {
        // Remove words present in wordsToRemove
        const filteredArray = arrayToEdit.filter(word => !wordsToRemove.includes(word));

        // Add words from wordsToAdd that are not already in filteredArray
        const finalArray = [...filteredArray];
        wordsToAdd.forEach(word => {
            if (!finalArray.includes(word)) {
            finalArray.push(word);
            }
        });

        return finalArray;
    }
    //To make the initial prompt containing the narrative instructions
    async function promptNarrative() {
        try {
            const { data, error } = await supabase
                .from('taste')
                .select('narrative');

            if (error) {
                console.error('Supabase error fetching narrative data:', error);
                throw new Error(`Database error: ${error.message || 'Failed to fetch narrative preferences.'}`);
            }

            if (data && Array.isArray(data) && data.length === 0) {
                return undefined; 
            } 

            const randomElements = getRandomElements(data, 3); 
            const destinationComp = randomElements[0].narrative.story_destination;
            const mergedElements = mergeElements(randomElements);
            const narrativeComps = getRandomElementsFromEachArray(mergedElements,5);

            // Basic validation for narrativeComps
            const requiredComponents = [
                "audience",
                "characters",
                "characters_archetype",
                "characters_description",
                "characters_elements",
                "characters_related_nouns",
                "characters_relationship",
                "characters_role",
                "plot_archetype",
                "plot_description",
                "settings_description",
                "settings_places",
                "settings_styles",
                "settings_time",
                "story_genre",
                "story_pace",
                "story_style",
                "story_subgenre",
                "story_theme",
                "story_tone",
                "story_topic"
            ];
            for (const key of requiredComponents) {
                // Check if the component exists and has at least one element (from slice(0,1))
                if (!narrativeComps[key]) {
                    // Fallback to a generic empty array if a component is missing
                    narrativeComps[key] = [];
                }
            }
            if (destinationComp.characteristic?.length>0&&destinationComp.destinations?.length>0){
                narrativeComps['story_destination'] = destinationComp;
            } else {
                narrativeComps['story_destination'] = {
                    characteristic: [],
                    destinations: []
                }
            }
            const novelStoryPrompt = `
                You are going to tell a short addictive and compelling story. You will use the Freytag's Pyramid as a reference for the structure. 
                To tell the story you have to use a ${narrativeComps.story_tone[0]} tone and tell it in a pace like ${narrativeComps.story_pace[0]}. The genre of the story you will tell is ${narrativeComps.story_genre[0]} and ${narrativeComps.story_genre[1]}, its subgender ${narrativeComps.story_subgenre[0]} and ${narrativeComps.story_subgenre[1]}, diving in themes like [${narrativeComps.story_theme.slice(0,3)}] and in topics like  ${narrativeComps.story_topic}. The plot is a ${narrativeComps.plot_description[0]} one and its archetype is ${narrativeComps.plot_archetype[0]}. The story is oriented towards an ${narrativeComps.audience[0]} audience. The story has a ${narrativeComps.story_style[0]} style.
                These are the details for the Exposition part:
                The exposition part will be told in 5 segments. 
                The place of the setting is a ${narrativeComps.settings_places[0]}, it's set in ${narrativeComps.settings_time[0]} times. Its style is ${narrativeComps.settings_styles[0]} and it holds ${narrativeComps.settings_description[0]} visuals.
                The main character is a  ${narrativeComps.characters_description.slice(0,2)} ${narrativeComps.characters[0]}, its archetype is ${narrativeComps.characters_archetype[0]} and its role in the story's world is ${narrativeComps.characters_role[0]}. They have these elements [${narrativeComps.characters_elements.slice(0,2)}] and if suited for them and for the story, they could be related to a ${narrativeComps.characters_related_nouns[0]}. Evaluate if the main character will have key supporting characters or if the story will hold secondary ones in this part. Afterwards, if suited, take at most two from here: [${narrativeComps.characters.slice(1)}] they could have any of these roles [${narrativeComps.characters_role.slice(1)}] and be related, if suited, to [${narrativeComps.characters_related_nouns.slice(1)}]. If you will include them, then the character’s relationship is ${narrativeComps.characters_relationship[0]}. 
                Final advice:
                ALWAYS MAKE SURE TO NOT USE THE INSTRUCTIONS I GAVE YOU AND I WILL GIVE YOU FOR THE STORY AS WORDS IN THE STORY. 
                The very first sentence or paragraph needs to grab the reader's attention immediately and make them want to continue.
                Keep the total number of characters very limited. Each one should have a clear purpose. And make dialogue revealing of character and purposeful for advancing the plot. Every word counts. Cut anything extraneous. Eliminate anything that doesn't contribute to character, plot, setting, or theme.
                Let the theme of the story emerge naturally from the characters' actions and the events of the story. Similarly, if you use symbolism, let it be subtle and enhance the story, rather than feeling forced.
                Instead of telling the reader something, show it through actions, sensory details, and dialogue; engage all five senses (sight, sound, smell, taste, touch) in your descriptions. Don't just tell them what things look like; tell them what they feel, hear, smell, and even taste. 
                For all characters, places, unique species, technologies, and all concepts/unique terms introduced in this story, generate names that are exceptionally uncommon, highly original, and phonetically distinct from any commonly known names or combinations. Under no circumstances should you create names that are blends or variations of existing common names or previously generated unique names/concepts (e.g., if 'Kael' or 'Elena' exist, do not use 'Kaelenus' or 'Elara').Steer clear of generic human names, common fantasy names, generic sci-fi names, or names that sound like existing famous characters or places. Aim for names that sound truly alien, ancient, melodic, harsh, or conceptually unique to this specific story's world. They should suggest a unique linguistic or cultural origin that is not immediately recognizable. Consider names that are unusual phonetic combinations, abstract or symbolic, or inspired by obscure sources (transformed to be original). Crucially, these names must be easy to read and pronounce, engaging, and memorable. They should be distinct from each other within the narrative and truly unique across different novel generations, ensuring each new story has fresh, non-recurrent naming. Ideally, they should subtly convey some essence or quality of what they represent within the narrative.
                If some of my specifications say 'undefined' or are empty arrays, craft a originally sustitute for it based on the soul of the current story. 
            `
            return {prompt: novelStoryPrompt, components: narrativeComps};

        } catch (err) {
            console.error('Error while prompting instructions for the story:', err);
            throw err; 
        }
    }
    
    
    async function fetchSavedWords() {
        const { data, error } = await supabase
            .from('stones')
            .select('stone_id, base_words,getting_used_words,comfortable_words');

        if (error) {
            console.error('Error fetching saved words:', error);
            throw new Error('Failed to fetch saved words.');
        }
        if (!data || data.length === 0) {
            return null;
        }
        if(data[0].getting_used_words===null){
            data[0].getting_used_words = []
        }
        if(data[0].comfortable_words===null){
            data[0].comfortable_words = []
        }
        return data[0]; 
    }

    function removeCaseInsensitiveDuplicates(arr) {
        const seen = new Set();
        const result = [];

        for (const item of arr) {
            const lowerCaseItem = String(item).toLowerCase(); // Ensure item is string before toLowerCase
            if (!seen.has(lowerCaseItem)) {
                seen.add(lowerCaseItem);
                result.push(item);
            }
        }
        return result;
    }

    //To insert a new story along with its segments, chat history with gemini...
    async function insertInitialStory (comp,content,seg){
        const newPrompt = `You are a multilingual language-learning assistant. Your task is to create a single addictive story in ${language} that incorporates a fixed pool of ${foreign_language} words.
        1. Pool of words:
        The pool of words is this:[${seg.pool_words}]. Never output any other ${foreign_language} word that is not in the pool, no matter the circumstance.
        2.Story Format:
        If in the story you need to use the ${language} word equivalent of any ${foreign_language} word that is in the pool of words, use instead and always the ${foreign_language} word version. You must use just ${foreign_language} words from the pool of words. Never use in the story, nor in any of your outputs, any other ${foreign_language} words that aren't in the pool, no matter the circumstance, this must never be broken, is a rule. The story will be told in segments of around 80 words length. If in a certain segment you had to use ${foreign_language} words, that segment length needs to be around 110 words instead.
        3.Grammar and coherence:
        You are free to construct phrases or even whole sentences in ${foreign_language} if needed, using the ${foreign_language} words from the word pool. The usage of the ${foreign_language} words must follow the ${foreign_language} grammar rules and nature of the language.
        4.Story creation instructions:
        `;
        const arraySegments = []
        arraySegments.push(seg.story)
        try {
            const {data,error} = await supabase
            .from('novel')
            .insert([{
                segment:arraySegments,
                title: seg.title,
                story_context: [
                    {
                        role: 'user',
                        parts:[{text:`${newPrompt}${content}`}]
                    },
                    {
                        role: 'model',
                        parts:[{text:seg.story}]
                    },
                ],
                story_components:comp
            }])
            .select()

            if (error) {
                console.error('Supabase Error inserting initial segment and story context:', error);
                // Propagate a specific error message
                throw new Error(`Database error: ${error.message || 'Failed to insert segment.'}`);
            }

            if (!data || !data[0].story_id) {
                throw new Error('Possible RLS Error, no data inserted');
            }
            const insertedStoryId = data[0].story_id;
            return insertedStoryId;

        } catch(err){
            console.error('Error inserting the new story:', err);
            throw err
        }
    }
    async function sendWordsSupabase(savedStone,newPool) {
        try {
            if (savedStone === null) {
                // No existing stone, insert new
                const { error: insertError } = await supabase
                    .from('stones')
                    .insert([{
                        base_words: newPool
                    }]);

                if (insertError) {
                    console.error('Error inserting new base words and creating stone:', insertError);
                    throw new Error('Failed to insert new words into Supabase.');
                }
            } else {
                const wordsToErase = [...savedStone.getting_used_words,...savedStone.comfortable_words]
                const rawWords = [...savedStone.base_words,...newPool]; //Takes already existing base words and mix it with the new pool
                const nonDuplicateWords = removeCaseInsensitiveDuplicates(rawWords) //In the pool could have been words that were already in the base words group
                
                const uniqueBaseWords = editWords(nonDuplicateWords,wordsToErase); //Erase the getting used words and comfortable words (if in there were any)

                const { error: updateError } = await supabase
                    .from('stones')
                    .update({base_words: uniqueBaseWords})
                    .eq('stone_id', savedStone.stone_id)
                    .select();
                if (updateError) {
                    console.error('Error updating base words for existing stone:', updateError);
                    throw new Error('Failed to update words in Supabase.');
                }
            }
        } catch (error) {
            throw error;
        }
    }

    //Send the narrative instructions along with the language instructions 
    async function sendPromptGemini(content) {
        if (!content) {
            console.error('No prompt content provided for Gemini.');
            throw new Error('Cannot generate story: No prompt content available.');
        }
        const languagePrompt = `
            You are a multilingual language-learning assistant. Your task is to create a single engaging story in ${language} that incorporates a fixed pool of ${n} ${foreign_language} words.
            Fixed Rules:
            1.Word Pool Lock:
            At the beginning of the session select ${n} unique foreign words from the target language, they must not repeat. Do not reveal them. Locked them and never output any other ${foreign_language} word that is not in the pool, no matter the circumstance.
            Story Format:
            2.0. If in the story you need to use the ${language} word equivalent of any ${foreign_language} word that is in the word pool, use instead and always the ${foreign_language} word version. You must use just ${foreign_language} words from the word pool. Never use in the story, nor in any of your outputs, any other ${foreign_language} words that aren't in the pool, no matter the circumstance, this must never be broken, is a rule.
            2.1.The story will be told in segments of around 80 words length. If in a certain segment you needed to use ${foreign_language} words, that segment length needs to be around 110 words instead.
            3.1. Narrative:
            The start of the narrative must be completely engaging, exciting and so unique that it is extremely difficult to replicate.
            4.${foreign_language} Words Selection Method:
            Select ${type_word} words.
            Select words that deepen engagement, reinforce narrative, or feel contextually natural.
            They should be picked based on the story you’re building, not randomly.
            5.Grammar and coherence:
            You are free to use phrases or even whole sentences in ${foreign_language} if needed. The usage of the ${foreign_language} words must follow the ${foreign_language} grammar rules and nature of the language.
            6.Story creation instructions:
        `;
        const completePrompt = `${content}. 7. Do not make the ${foreign_language} words stand out, you would be making worst the reading experience of the user, so don't do it. 8.In each of your turns you will output uniquely the next segment.9.Ensure you did exactly all I asked you to do`
        try {
            const result = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents:`${languagePrompt}${completePrompt}.Just for this turn, give me the title and the pool of words along the segment too. For the novel's title, create an uncommon, highly original, and evocative title that hints at the story's depth without revealing too much. Absolutely avoid generic fantasy, sci-fi, or overly dramatic clichés.`,
                config:{
                    responseMimeType: "application/json",
                    responseSchema: {
                        type: "object",
                        properties: {   title: {type:'string'},
                                        story: {type:'string'},
                                        pool_words: {type:'array',items:{type:'string'}}
                        },   
                        propertyOrdering: ['title','story','pool_words']
                    },
                    temperature:1.4          
                }      
            });
            
            const responseText = result.text;
            
            if (!responseText) {
                console.warn('Gemini generated an empty response for a new story generation.');
                throw new Error('Gemini failed to generate a story (empty response).');
            }
            return {userPrompt:completePrompt,modelResponse:responseText};

        } catch (err) {
            console.error('Error with Gemini API:', err);
            // Check for specific Gemini API errors 
            if(err.status===429){
                throw new Error(`Too many requests are being received at this moment, please wait a moment`);
            } else if(err.status) { 
                 throw new Error(`Gemini API error: ${err.status} - ${err.message || 'Failed to generate content.'}`);
            }
            throw new Error(`Gemini API call failed: ${err.message || 'Unknown error.'}`);
        }
    }

    // Main route handler
    try {
        
        const promptContent = await promptNarrative();
        
        if (promptContent === undefined){
            res.status(204).send()
            return;
        }
        const storedWords = await fetchSavedWords();

        let generatedStorySegment,parsedStory;

        if (storedWords!==null&&(storedWords?.comfortable_words.length>0||storedWords?.getting_used_words.length>0)){
            //Changes the number of words that the gemini model will generate

            const {comfortable_words:wordsToErase,getting_used_words:wordsToAdd} = storedWords;

            let reducer = 0.85; //Decrease factor to avoid generating too many new words
            if (wordsToErase.length > Math.round(n/2)||wordsToAdd.length > Math.round(n/2)){
                n+= Math.round(wordsToErase.length*reducer)
                n+= Math.round(wordsToAdd.length*reducer)

            }
            generatedStorySegment = await sendPromptGemini(promptContent.prompt);
            parsedStory = await JSON.parse(generatedStorySegment.modelResponse);
            const newPoollWords = editWords(parsedStory.pool_words,wordsToErase,wordsToAdd);
            parsedStory.pool_words = newPoollWords

        } else {
            //Not enough words were moved or no stone detected

            generatedStorySegment = await sendPromptGemini(promptContent.prompt);
            parsedStory = await JSON.parse(generatedStorySegment.modelResponse);
        }

        const newStoryId = await insertInitialStory(promptContent.components,generatedStorySegment.userPrompt,parsedStory)

        await sendWordsSupabase(storedWords,parsedStory.pool_words)
        
        res.status(200).json({
            message: 'The story segment was generated successfully!',
            storyId: newStoryId
        });

    } catch (err) {
        console.error('Overall new story generation failed:', err);
        res.status(500).json({
            error: err.message || 'Failed to generate story due to an internal server error.'
        });
    }
    
});

app.get('/api/stories/:storyId', async (req, res) => {
    const storyId = req.params.storyId;
    if (!storyId || typeof storyId !== 'string' || storyId.trim() === '') {
        return res.status(400).json({ message: 'Invalid or missing story ID in the request.' });
    }

    async function fetchStoryData(id) {
        const { data, error } = await supabase
            .from('novel')
            .select('segment,title,generation_status,ended')
            .eq('story_id', id);

        if (error) {
            console.error('Error fetching segments from Supabase:', error);
            throw new Error(`Database query failed: ${error.message}`);
        }

        // Check if data exists and is not empty.
        if (data && data.length > 0) {

            if (data[0].segment === undefined || data[0].title === undefined) {
                console.error('Fetched data is missing expected fields (segment or title).');
                throw new Error('Incomplete story data retrieved from database.');
            }

            return data[0]

        } else {
            // Return null to indicate that the story was not found.
            return null;
        }
    }

    try {
        const storyData = await fetchStoryData(storyId);

        if (!storyData) {
            return res.status(404).json({ message: `Story with ID '${storyId}' not found.` });
        }

        return res.status(200).json({
            segments: storyData.segment,
            title: storyData.title,
            is_generating: storyData.generation_status,
            is_ended: storyData.ended
        });

    } catch (error) {
        console.error('An unexpected error occurred in /api/stories/:storyId:', error);
        res.status(500).json({ error: 'An internal server error occurred while processing your request.' });
    }
});

app.post('/api/stories/:storyId/continue', async (req, res) => {
    const currentStoryId = req.params.storyId;

    if (!currentStoryId || typeof currentStoryId !== 'string' || currentStoryId.trim() === '') {
        return res.status(400).json({ message: 'Invalid or missing story ID in the request.' });
    }

    let nextSegPrompt = `Continue the story, building on the previous events. Maintain the established tone, style, and pacing. Deepen character reactions and sensory details. Show, don't tell. Ensure the narrative remains engaging and propels the reader forward. Do not make the ${foreign_language} words stand out. Ensure you do all it was instructed to you.Output the next segment`; 

    //To update the generation status
    async function changeGenerationStatus(id) {
        const { data, error } = await supabase
            .from('novel')
            .update({ generation_status: true })
            .eq('story_id', id)
            .select();

        if (error) {
            console.error('Supabase error while updating the generation status:', error.message, error.details); 
            
            throw new Error(`Failed to update generation status for story_id ${id}: ${error.message}. Code: ${error.code}`);
        }

        if (!data || data.length === 0) {

            throw new Error(`No novel found or updated for story_id: ${id}.`);
        }

        if (data[0].generation_status !== true) {
            console.warn(`Generation status for story_id ${id} was not updated to true as expected.`);
            throw new Error(`Unexpected generation status after update for story_id ${id}.`);
        }
        return data[0]; 
    }
    // To generate the next story segment
    async function generateNextSegment(id,currentHistory) {
        try {
            const chat = ai.chats.create({
                model: "gemini-2.5-flash",
                history: currentHistory.story_context,
                config: {
                    temperature: 1.3
                }
            });

            const response = await chat.sendMessage({
                message: nextSegPrompt
            });

            const responseText = response.text;

            if (!responseText) {
                console.warn('Gemini generated an empty response in next segment generation for story ID:', id);
                throw new Error('AI failed to generate the next part of the story (empty response).');
            }
            return responseText;
        } catch (err) {
            console.error('Error with Gemini API while generating new segment for story ID:', id, err);

            if (err.status) { // Assuming an HTTP error from the API
                throw new Error(`AI API error: ${err.status} - ${err.message || 'Failed to generate content.'}`);
            }
            throw new Error(`AI generation failed: ${err.message || 'Unknown error during AI call.'}`);
        }
    }
    // To update story history
    async function updateStoryHistory(prompt, seg, id,currentHistory,endedConfirmation=false) {
        try {
            const newTurn = [{
                role: 'user',
                parts: [{ text: prompt }]
            }, {
                role: 'model',
                parts: [{ text: seg }]
            }];

            const currentStoryContext = currentHistory.story_context;
            const newContext = [...currentStoryContext, ...newTurn];

            const currentSegments = currentHistory.segment;
            const newSegment = [...currentSegments, seg];

            const { data, error } = await supabase
                .from('novel')
                .update({
                    story_context: newContext,
                    segment: newSegment,
                    ended: endedConfirmation,
                    generation_status: false
                })
                .eq('story_id', id)
                .select();

            if (error) {
                console.error('Supabase error updating story history after new segment generation:', error);
                throw new Error(`Database error updating story history: ${error.message || 'Unknown database error.'}`);
            }
            if (!data || data.length === 0) {
                console.warn('Supabase story update in continue operation returned no data for story ID:', id, data);
                throw new Error('Story update failed: No data returned after update operation.');
            }
        } catch (error) {
            // Re-throw the error to be caught by the main try-catch block
            throw error;
        }
    }
    //To change the prompt for Gemini
    async function changeStoryPrompt(currentHistory){
        try {
            
            const numSegments = currentHistory.segment.length;

            const storyComps = currentHistory.story_components;

            const risignAction = `Start the rising action, build suspense, introduce complications, and develop the characters as they face obstacles leading to the climax. If the story is suited, use this setting as one of the included in this part of the story: ${storyComps.story_destination.characteristic[0]} ${storyComps.story_destination.destinations[0]}, or ones from here[${storyComps.settings_places.slice(1)}]. You will introduce characters that are relevant to the developing conflict, you can take from here as many as they are suited for the story: [${storyComps.characters}], they could have these archetypes [${storyComps.characters_archetype.slice(3)}] and be releated to [${storyComps.characters_related_nouns.slice(3)}]. It will be told in 40 segments.`;
            const climax = `Start the climax. The story is in the turning point where tension is at its peak. The protagonist must face their biggest challenge or make a crucial decision. This determines the story's outcome. It will be told in 5 segments. `
            const fallingAction = `Start the falling action. Show the events that occur after the climax, where the tension eases and the consequences of the climax unfold. Loose ends might be tied up, and other character arcs begin to resolve. It will be told in 7 segments.`;
            const resolution = `Start the resolution (ending). Even if it's not a "happy" ending, it should feel earned and complete for the story's scope. It should provide closure for the main conflict and show the protagonist's final state or change. Provide a satisfying conclusion that resonates with the reader and gives a sense of what happened and what it means.It will be told in 4 segments.`

            if (numSegments === 5) { //Checks the current number of segments for possible prompt changing
                nextSegPrompt = risignAction;
            } else if (numSegments === 45) {
                nextSegPrompt = climax;
            } else if (numSegments === 50){
                nextSegPrompt = fallingAction;
            } else if (numSegments === 57) {
                nextSegPrompt = resolution;
            } else if (numSegments === 60) { 
                nextSegPrompt = 'You will output the last segment of the story. Amaze the readers';
            } 
            return numSegments;
        } catch(err){
            throw new Error(err)
        }
    }
    // Main execution flow
    try {
        const storyHistory = await changeGenerationStatus(currentStoryId);

        const numberSegments = await changeStoryPrompt(storyHistory); //before calling the next segment generation
        
        const nextSegment = await generateNextSegment(currentStoryId,storyHistory);

        if (numberSegments===maxStoryLength-1){
            await updateStoryHistory(nextSegPrompt, nextSegment, currentStoryId,storyHistory,true);
        } else {
            await updateStoryHistory(nextSegPrompt, nextSegment, currentStoryId,storyHistory);
        }
        
        res.status(200).json({
            countSegment:numberSegments,
            newSegment: nextSegment
        });
    } catch (err) {
        console.error('Overall story continuation failed for story ID:', currentStoryId, err);

        //Update story generation status to false
        const {error} = await supabase
        .from('novel')
        .update({ generation_status: false })
        .eq('story_id', currentStoryId)

        if (error){
            console.error('Failed to update the generation status after error in the next segment generation:',error)
        }


        let statusCode = 500; 
        let errorMessage = 'Failed to generate next segment due to an internal server error.';

        if (err.cause === 'NOT_FOUND') {
            statusCode = 404;
            errorMessage = 'Story not found for the provided ID.';
        } else if (err.message.includes('Database error')) {
            statusCode = 500; 
            errorMessage = 'A database error occurred while processing your request.';
        } else if (err.message.includes('AI API error') || err.message.includes('AI generation failed')) {
            statusCode = 500; 
            errorMessage = 'The AI service encountered an issue while generating the story.';
        } else if (err.message.includes('empty response')) {
            statusCode = 500; 
            errorMessage = 'The AI could not generate a valid response for the story.';
        }

        res.status(statusCode).json({
            error: errorMessage
        });
    }
});

app.post('/api/translations', async (req, res) => {
    const { segment: segText, segmentIndex: index, storyId: id } = req.body;

    if (!segText || index === undefined || !id) {
        return res.status(400).json({ error: 'Missing required parameters: segment, segmentIndex, or storyId.' });
    }

    async function translateSegment(seg) {
        try {
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: `Replace all ${foreign_language} words with their equivalent or translation to  ${language}, maintaining sense and coherence. After that, replace all text with enclosed ellipses in square brackets (this:[...]) except for the words that were translated and their immediate 2 neighboring words. I do not want to see the changes you made, so do not make the translated words stand out nor the [...]. Give the near words space from the [...], they must be clearly separated from it. Give me back the new text and ensure you did exactly all I asked you to do.  The paragraph: ${seg}`
            });

            const responseText = response.text;
            if (!responseText) {
                console.warn('Gemini generated an empty response for translation generation.');
                throw new Error('Gemini failed to generate a translation (empty response).');
            }
            return responseText;
        } catch (error) {
            console.error('Error during AI translation generation:', error);
            throw new Error(`Failed to generate translation from AI: ${error.message || error}`);
        }
    }

    async function updateTranslations(newTransl, storedTransl) {
        const newTranslDict = { index: index, translation: newTransl };
        const newStoredTransl = [...storedTransl, newTranslDict];
        try {
            const { error } = await supabase
                .from('novel')
                .update({ translations: newStoredTransl })
                .eq('story_id', id)
                .select();
            if (error) {
                throw new Error(error.message || 'Error updating translations');
            }
        } catch (error) {
            console.error('Error updating translations in Supabase:', error);
            throw new Error(`Failed to update translations: ${error.message || error}`);
        }
    }

    async function fetchTranslations() {
        try {
            const { data, error } = await supabase
                .from('novel')
                .select('translations')
                .eq('story_id', id);

            if (error) {
                throw new Error(error.message || 'Failed to fetch translations');
            }
            return data[0]?.translations || [];
        } catch (error) {
            console.error('Error fetching translations from Supabase:', error);
            throw new Error(`Failed to fetch translations: ${error.message || error}`);
        }
    }

    try {
        const storedTransl = await fetchTranslations();//Fetch translations for the story ID to verify already existing ones
        let translation;

        if (Array.isArray(storedTransl)) {
            for (let i = 0; i < storedTransl.length; i++) {
                if (storedTransl[i].index === index) {
                    //If the translation was already made, return it
                    return res.status(200).json({ translation: storedTransl[i].translation });
                }
            }
        }

        translation = await translateSegment(segText);
        await updateTranslations(translation, storedTransl);
        return res.status(200).json({ translation: translation });

    } catch (err) {
        console.error('Overall translation process failed:', err);
        return res.status(500).json({ error: err.message || 'An unknown error occurred during translation.' });
    }
});

app.post('/api/words', async (req, res) => {
    const { selectedWords: words, target } = req.body;

    if (!words || !target) {
        return res.status(400).json({ error: 'Missing selectedWords or target in request body.' });
    }

    const validTargets = ['base_words', 'getting_used_words', 'comfortable_words'];
    if (!validTargets.includes(target)) {
        return res.status(400).json({ error: `Invalid target: ${target}. Must be one of ${validTargets.join(', ')}.` });
    }

    //To remove any words from the objA list that are also present in the corresponding objB list.
    function filterWords(objA, objB) {
        const result = {
            base_words: [...objA.base_words],
            getting_used_words: [...objA.getting_used_words],
            comfortable_words: [...objA.comfortable_words]
        };

        for (const key in objA) {
            if (objA.hasOwnProperty(key) && objB.hasOwnProperty(key)) {
                const bWords = new Set(objB[key]);
                result[key] = result[key].filter(word => !bWords.has(word));
            }
        }
        return result;
    }

    async function fetchWordsAndStoneId() {
        const { data, error } = await supabase
            .from('stones')
            .select('base_words,getting_used_words,comfortable_words,stone_id')
            .single(); 

        if (error) {
            console.error('Error fetching words data in /api/words:', error);
            throw new Error('Failed to fetch words.'); 
        }
        // Ensure data is not null
        if (!data) {
            return { base: [], getting: [], comfortab: [] };
        }
        
        const base_words = data.base_words ?? [];
        const getting_used = data.getting_used_words ?? [];
        const comfortable = data.comfortable_words ?? [];
        return { base: base_words, getting: getting_used, comfortab: comfortable, stone_id:data.stone_id };
    }
    
    //Updates the target group
    async function updateWords(newWords, target_column,id) {
        const { data, error } = await supabase
            .from('stones')
            .update({ [target_column]: newWords })
            .eq('stone_id',id)
            .select(); 

        if (error) {
            console.error('Error updating the target group in /api/words:', error);
            throw new Error(`Failed to update words for ${target_column}.`); 
        }
        return data; 
    }

   //To clean the actual stored words, across groups
    async function updateFilteredWords(filtered,id){
        const { data, error } = await supabase
            .from('stones')
            .update(filtered)
            .eq('stone_id',id)
            .select(); 

        if (error) {
            console.error('Error in clean update for all groups of words in /api/words:', error);
            throw new Error(`Failed to update filtered words`);
        }
        return data;
    }

    //Initial sorting for words sent from the fronted
    const wordsToErase = {base_words:[],getting_used_words:[],comfortable_words:[]}
    words.forEach(word=>{
        if (word.id.split('-')[1] === 'getting_used_words'){
            wordsToErase.getting_used_words.push(word.value)
        } else if (word.id.split('-')[1] === 'base_words'){
            wordsToErase.base_words.push(word.value)
        } else if(word.id.split('-')[1] === 'comfortable_words'){
            wordsToErase.comfortable_words.push(word.value)
        }
    })

    try {
        const storedWords = await fetchWordsAndStoneId();

        const { base: baseWords, getting: gettingWords, comfortab: comfortabWords,stone_id:stone_id } = storedWords;

        const originalWords = {
            base_words: [...baseWords],
            getting_used_words: [...gettingWords],
            comfortable_words: [...comfortabWords]
        }
        //Erase the words from the original fetched list
        const filteredWords = filterWords(originalWords,wordsToErase);

        //Update the database with the clean object and receive it back
        const updatedWords = await updateFilteredWords(filteredWords,stone_id);

        const {base_words:newBaseWords,getting_used_words:newGettingWords,comfortable_words:newComfortabWords} = updatedWords[0]
        
        let newWordsArray;
        let columnToUpdate = target; 

        let wordsToStore =[];
        let frontedTarget;

        words.forEach(word =>{
            wordsToStore.push(word.value)
        })

        //Add the words in the new cleaned targed group
        switch (target) {
            case 'base_words':
                frontedTarget = 'Base'
                newWordsArray = [...newBaseWords, ...wordsToStore];
                break;
            case 'getting_used_words':
                frontedTarget = 'Familiar'
                newWordsArray = [...newGettingWords, ...wordsToStore];
                break;
            case 'comfortable_words':
                frontedTarget = 'Learned'
                newWordsArray = [...newComfortabWords, ...wordsToStore];
                break;
            default:
                return res.status(500).json({ error: 'Internal server error: Invalid target column.' });
        }

        //Update the target group, in the data base, with the new list of words
        await updateWords(newWordsArray, columnToUpdate,stone_id);

        res.status(200).json({ message: `Words successfully updated to ${frontedTarget}.` });

    } catch (err) {
        console.error('Overall error in /api/words:', err.message); 
        res.status(500).json({ error: 'An unexpected error occurred during the update operation.' });
    }
});

app.post('/api/signIn',  async (req,res)=>{
    const {email, password} = req.body;

    if (!email||!password) {
        return res.status(400).json({error: 'Email and password required'})
    }

    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            console.error('Sign-in error:', error.message);
            return res.status(401).json({ error: error.message });
        }
        if (data.session) {
            return res.status(200).json({
                message: 'Sign in successful!',
            });
        } else {
            return res.status(500).json({ error: 'Sign in failed for an unknown reason.' });
        }
    } catch (err) {
        console.error('Unexpected error during sign-in:', err);
        return res.status(500).json({ error: 'Internal server error during sign-in.' });
    }
});

app.post('/api/signUp',  async (req,res)=>{
    const {email, password} = req.body;

    if (!email||!password) {
        return res.status(400).json({error: 'Email and password required'})
    }

    try {
        const { data, error } = await supabase.auth.signUp({
            email: email,
            password: password,
        });

        if (error) {
            console.error('Sign-up error:', error.message);
            return res.status(401).json({ error: error.message });
        }
        if (data.session) {
            return res.status(200).json({
                message: 'Sign up successful!',
            });
        } else {
            return res.status(500).json({ error: 'Sign up failed for an unknown reason.' });
        }
    } catch (err) {
        console.error('Unexpected error during sign-up:', err);
        return res.status(500).json({ error: 'Internal server error during sign-up.' });
    }
});

app.post('/api/signOut', async (req,res)=>{
    try {
        const { error } = await supabase.auth.signOut({ scope: 'local' });

        if (error) {
            console.error('Sign-out error:', error.message);
            return res.status(401).json({ error: error.message });
        }

        return res.status(200).send()
        
    } catch (err) {
            console.error('Unexpected error during sign-out operation:', err);
            return res.status(500).json({ error: 'Internal server error during sign-out.' });
    }
})

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});

