import numpy as np

def project_vector(vector, onto_vector):
    """
    Projects a vector onto another vector.
    
    Args:
        vector (np.ndarray): The vector to be projected.
        onto_vector (np.ndarray): The vector onto which the projection is performed.
    
    Returns:
        np.ndarray: The projected vector.
    """
    normalized_onto_vector = onto_vector / np.linalg.norm(onto_vector)
    projection = np.dot(vector, normalized_onto_vector) * normalized_onto_vector
    return projection


