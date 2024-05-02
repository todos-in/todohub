[!WARNING]  
> **42 TODO**'s without an issue reference found for this repository
>

`TODO`'s should **always** reference an issue in github to prevent them from getting lost.
Instead of writing a comment like `TODO fix this` that tent to get forgotten, reference an issue where the todo should be tackeled `TODO #42 fix this`.

<details><summary>Examples:</summary>

### The \"getting to a happy path\" TODO

You are Working on issue `#42` - on this awesome new feature. You are in flow staten and just want to see it working - yeah those exceptions are not helpful for now.

```javascript
try {
   // ... your crazy code bringing the new awesome feature of issue #42 to live
}  catch (e) {
   // TODO handle non happy path
}
```
 The `TODO` in code here is great to get it out of your head for **now** but it also tent to just end up forgotten.

Instead of loosing tack of the `TODO`'s just add your current issue number like:

```diff
try {
   // ... your crazy code bringing the new awesome feature of issue #42 to live
}  catch (e) {
-   // TODO handle non happy path
+   // TODO #42 handle non happy path
}
```

### The \"ugly but we cant fix this for now - we should do this later\" TODO

You are working on an issue that aims to make your app's UI/UX more inclusive. The `gender` property you need is sourced from a third party api and the servers response already contains it - but the library you are using to fetch the data didn't catch up on the types yet. Accessing `gender` is possible by casting the response to `any` and access the known property directly.

```typescript
...
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- lib doesn't provide the gender property in its type yet 
const user = await thirdPartyLib.getUser() as any // TODO fix when library types are updated https://link.to.issue.in.third.party.lib
const name = user.name;
if (user.gender !== undefined) {
   ....
}
```
To pass the CI you deactivated the `no-explicit-any` lint rule for the this particular exception. Great you unblocked this issue from your dependency. You described the reason for the lint rule exception, the `TODO` you add describes what to do and even contains a link that keeps track if the problem can be fixed. Wow - this is a great - it contains all information needed - BUT again the chance is high that you will see this `TODO` only again when you had some hard time debugging a runtime error that was cause by an API change of the third party sdk, that replaced name by firstName and lastName property - and stays hidden by the `any` type.

How to deal with such a `TODO`? There is nothing you can do about this in your current issue `#42`. This time you want to track this TODO in a new issue. Just create an \"remove any type when SDK XYZ provides gender property in the Type definition\" Issue in github. And add the number of your newly created issue (lets say `#43`) to your TODO like:

```diff
...
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- lib doesn't provide the gender property in its type yet 
-const user = await thirdPartyLib.getUser() as any // TODO fix when library types are updated 
+const user = await thirdPartyLib.getUser() as any // TODO #43 fix when library types are updated 
https://link.to.issue.in.third.party.lib
const name = user.name;
if (user.gender !== undefined) {
   ....
}
```

### The \"premature optimization\" TODO

You are still working on issue `#42` - you need to add a function that returns a user by its id. Users are stored in an array and finding it means iterating though the whole array. You have the feeling that this becomes slow in the future. You feel soo ashamed of not writing optimized code but something tells you - stop think about this - this is a premature optimization trap!

```typescript
const users: User[];
function getUserById(id: string) {
    // TODO O(n)... this iterates though all user we could consider to use a map here instead?
    return users.find(user => user.id === id)
}
```

The `TODO` you add gives you a better feeling because it expresses you are aware of the O(n) here and it can help you or your colleagues to tackle a possible performance issue. How to deal with such a `TODO`?
Think of it - might be you never have to change this - there might never be something `TODO` here - so just turn it into a `NOTE`:
```diff
const users: User[];
function getUserById(id: string) {
-   // TODO O(n)... this iterates though all user we could consider to use a map here instead?
+   // NOTE: O(n)... this iterates though all user we could consider to use a map here instead?
    return users.find(user => user.id === id)
}
```
</details>





