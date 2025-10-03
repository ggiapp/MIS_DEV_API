import jwt from 'jsonwebtoken'

const ggiAuth = (ggiToken) => {
    

    
    if (!ggiToken) {
       console.log("Auth Token Invalid")
    }
    try {
        const decode = jwt.verify(ggiToken, 'secret_key')
        req.user = decode;
        const {userId} = decode;

        return userId;
    } catch (err) {
         return err;
    }
}

export default ggiAuth;