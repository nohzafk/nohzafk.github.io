---
title: what is retrieval augmented generation
date: 2023-11-22T10:33:40+0800
tags: [llm, machine learning, rag]
---
This video gives an easy explanation about RAG(retrieval augmented generation)

https://youtu.be/T-D1OfcDW1M?si=a_06Z9VkMSwuh6To

Here is my notes about RAG

## limitations of Large Language Model (LLM)
- **Outdated Information**: LLMs are often limited by the data they were trained on, which can become outdated over time. This leads to responses that may no longer be accurate or relevant.
- **Lack of Fact-Checking**: Traditional LLMs do not have a mechanism to fact-check or verify the information they generate, which can lead to inaccuracies in their responses.

## why was RAG invented
The RAG technique was invented to enhance the accuracy and relevance of responses generated by LLMs. The key motivations for developing RAG were:
- `To Provide Up-to-Date Information`: By integrating a retrieval system, RAG ensures that the LLM has access to the most current information, thereby improving the accuracy of its responses.
- `To Improve Fact-Checking Capabilities`: RAG allows LLMs to cross-reference information with reliable sources, enhancing their ability to verify facts and provide more trustworthy responses.
- `To Address the Static Nature of LLMs`: Since LLMs are trained on static datasets, they can become outdated. RAG introduces a dynamic element where the model can access and incorporate new and updated information.

## how does it work
The RAG framework works by combining the capabilities of a traditional LLM with an external information retrieval system. The process involves:
- `Retrieval of Relevant Information`: When a query is made, the RAG system first retrieves relevant information from an external data store. This data store is continuously updated with new information.
- **Three-Part Prompt Processing**: The LLM receives a three-part prompt consisting of the instruction, the retrieved content, and the user's question.
- `Generation of Informed Responses`: The LLM uses both the retrieved information and its pre-existing knowledge base to generate a response. This ensures that the response is not only based on its training data but also on the most current information available.
- `Continuous Updating`: The data store used for retrieval is continuously updated, allowing the LLM to stay current with new information and developments.

## example of the three-part prompt
- `Instruction`: This is a directive or guideline that tells the language model what kind of response is expected. It sets the context or the goal for the response.
- `Retrieved Content`: This part includes the relevant information retrieved from a large-scale data store. This content is dynamically sourced based on the query, ensuring that the information is up-to-date and pertinent to the user's question.
- `User's Question`: This is the actual query or question posed by the user. It's what the user wants to know or the problem they need solved.

### Example of a Three-Part Prompt
Here's how the three-part prompt might looks like:
```text
Use the following pieces of context to answer the question at the end.
If you don't know the answer, just say that you don't know, don't try to make up an answer.
Use three sentences maximum and keep the answer as concise as possible.
Always say "thanks for asking!" at the end of the answer.

<An article or a set of articles from a reputable source, retrieved by the system, discussing the latest developments in AI as of 2023.>

Question: "What are the latest advancements in artificial intelligence?"
```
refer [langchain](https://python.langchain.com/docs/use_cases/question_answering/#go-deeper-4)
